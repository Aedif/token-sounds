import { SoundOfToken } from './scripts/api.js';
import { registerTokenHooks } from './scripts/tokenHooks.js';

export const MODULE_ID = 'aedifs-token-sounds';

const SETTINGS = {
  nonRepeat: [],
};

Hooks.on('init', () => {
  game.settings.register(MODULE_ID, 'nonRepeat', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    onChange: (val) => {
      SETTINGS.nonRepeat = val;

      const isResponsibleGM =
        game.user.isGM &&
        !game.users
          .filter((user) => user.isGM && (user.active || user.isActive))
          .some((other) => other.id < game.user.id);

      if (isResponsibleGM) {
        if (val.length) startTicker();
      }
    },
  });
  SETTINGS.nonRepeat = game.settings.get(MODULE_ID, 'nonRepeat');

  libWrapper.register(
    MODULE_ID,
    'AmbientSound.prototype.sync',
    async function (wrapped, ...args) {
      let result = await wrapped(...args);
      if (this.sound && this.sound.playing && this.document.getFlag(MODULE_ID, 'autoGen')) {
        this.sound.loop = this.document.repeat;
      }

      return result;
    },
    'WRAPPER'
  );

  libWrapper.register(
    MODULE_ID,
    'AmbientSound.prototype._createSound',
    function (wrapped, ...args) {
      if (this.document.getFlag(MODULE_ID, 'autoGen')) {
        const path = this.document.path;
        if (!this.id || !path) return null;
        return game.audio.create({
          src: path,
          context: new AudioContext(game.audio.environment),
          singleton: false,
        });
      } else {
        return wrapped(...args);
      }
    },
    'MIXED'
  );

  registerTokenHooks();

  // Handle broadcasts
  game.socket?.on(`module.${MODULE_ID}`, (message) => {
    if (!game.user.isGM) return;
    const isResponsibleGM = !game.users
      .filter((user) => user.isGM && (user.active || user.isActive))
      .some((other) => other.id < game.user.id);
    if (!isResponsibleGM) return;

    const args = message.args;

    if (message.handlerName === 'sound' && message.type === 'CREATE') {
      const token = game.scenes.get(args.sceneId)?.tokens.get(args.tokenId);
      if (token) createSound(token, args.sound, true);
    } else if (message.handlerName === 'sound' && message.type === 'DELETE') {
      const ambientSound = game.scenes.get(args.sceneId)?.sounds.get(args.ambientSoundId);
      if (ambientSound) ambientSound.delete();
      endNonRepeatEarly(args.tokenId, args.soundId, args.sceneId);
    } else if (message.handlerName === 'sound' && message.type === 'POSITIONS') {
      const scene = game.scenes.get(args.sceneId);
      if (scene) refreshSoundPosition(scene.tokens.get(args.tokenId));
    } else if (message.handlerName === 'sound' && message.type === 'NONREPEAT') {
      const scene = game.scenes.get(args.sceneId);
      if (scene) setNonRepeatTicker(scene.get(args.tokenId), args.soundId, args.endTime);
    }
  });

  globalThis.SoundOfToken = SoundOfToken;
});

Hooks.on('ready', () => {
  const isResponsibleGM = !game.users
    .filter((user) => user.isGM && (user.active || user.isActive))
    .some((other) => other.id < game.user.id);
  if (isResponsibleGM) startTicker();
});

export async function playSounds(token, soundIds) {
  const dataSource = game.actors.get(token.actorId) ?? token;

  const sounds = dataSource.getFlag(MODULE_ID, 'sounds') ?? {};
  const playing = token.getFlag(MODULE_ID, 'playing') ?? {};

  // If no ids are provided assume all current sounds marked as playing
  if (!soundIds) soundIds = Object.keys(playing);
  const attached = token.getFlag(MODULE_ID, 'attached') ?? {};

  for (const soundId of soundIds) {
    if (!attached[soundId] && playing[soundId] && sounds[soundId]) {
      await createSound(token, sounds[soundId]);
    }
  }

  refreshSoundPosition(token);
}

export function stopSounds(token, soundIds) {
  const playing = token.getFlag(MODULE_ID, 'playing') ?? {};
  // If no ids are provided assume all current sounds marked as playing
  if (!soundIds) soundIds = Object.keys(playing);
  const attached = token.getFlag(MODULE_ID, 'attached') ?? {};

  for (const soundId of soundIds) {
    if (attached[soundId] && !playing[soundId]) {
      deleteSound(token, soundId, attached[soundId]);
    }
  }
}

export function deleteToken(token) {
  const attached = token.getFlag(MODULE_ID, 'attached') ?? {};

  for (const [soundId, ambientSoundId] of Object.entries(attached)) {
    const ambientSound = token.parent?.sounds.get(ambientSoundId);
    if (ambientSound) deleteSoundDocument(ambientSound, token, soundId);
  }
}

export function deleteSound(token, soundId, ambientSoundId) {
  const ambientSound = token.parent?.sounds.get(ambientSoundId);
  if (ambientSound) deleteSoundDocument(ambientSound, token, soundId);
  token.update({ [`flags.${MODULE_ID}.attached.-=${soundId}`]: null });
}

function deleteSoundDocument(doc, token, soundId) {
  if (!game.user.isGM) {
    const message = {
      handlerName: 'sound',
      args: { ambientSoundId: doc.id, tokenId: token.id, sceneId: token.parent.id, soundId },
      type: 'DELETE',
    };
    game.socket?.emit(`module.${MODULE_ID}`, message);
    return;
  }

  endNonRepeatEarly(token.id, soundId, token.parent.id);

  doc.delete();
}

function endNonRepeatEarly(tokenId, soundId, sceneId) {
  const newRepeat = SETTINGS.nonRepeat.filter(
    (o) => o.soundId !== soundId || o.tokenId !== tokenId || o.sceneId !== sceneId
  );
  if (SETTINGS.nonRepeat.length !== newRepeat.length) {
    game.settings.set(MODULE_ID, 'nonRepeat', newRepeat);
  }
}

function _processTick() {
  if (SETTINGS.nonRepeat.length) {
    const currentTime = Date.now();

    const nR = SETTINGS.nonRepeat.find((n) => n.endTime < currentTime);
    if (nR) {
      canvas.app.ticker.remove(_processTick);
      const token = game.scenes.get(nR.sceneId)?.tokens.get(nR.tokenId);
      if (token) token.update({ [`flags.${MODULE_ID}.playing.-=${nR.soundId}`]: null });

      SETTINGS.nonRepeat = SETTINGS.nonRepeat.filter((n) => n.endTime > currentTime);
      game.settings.set(MODULE_ID, 'nonRepeat', SETTINGS.nonRepeat);
    }
  } else {
    canvas.app.ticker.remove(_processTick);
  }
}

async function setNonRepeatTicker(token, soundId, endTime) {
  if (!game.user.isGM) {
    const message = {
      handlerName: 'sound',
      args: { tokenId: token.id, sceneId: token.parent.id, soundId, endTime },
      type: 'NONREPEAT',
    };
    game.socket?.emit(`module.${MODULE_ID}`, message);
    return;
  }

  SETTINGS.nonRepeat.push({ sceneId: token.parent.id, tokenId: token.id, soundId, endTime });
  await game.settings.set(MODULE_ID, 'nonRepeat', SETTINGS.nonRepeat);
}

function startTicker() {
  canvas.app.ticker.add(_processTick);
}

export async function createSound(token, sound, setPosition = false) {
  if (!game.user.isGM) {
    const message = {
      handlerName: 'sound',
      args: { tokenId: token.id, sceneId: token.parent.id, sound },
      type: 'CREATE',
    };
    game.socket?.emit(`module.${MODULE_ID}`, message);
    return;
  }

  const s = foundry.utils.deepClone(sound);
  if (!s.radius) s.radius = 30;
  s[`flags.${MODULE_ID}.autoGen`] = true;

  // Lets load the sound so that we can extract the duration from it.
  // Necessary on first time load, and when creating AmbientSound from another scene
  const audio = game.audio.create({ src: s.path, preload: false });
  if (audio) {
    if (!audio.loaded && audio._state !== audio.constructor.STATES.LOADING) {
      await audio.load();
    }
  }

  console.log(s);
  const doc = (await token.parent.createEmbeddedDocuments('AmbientSound', [s]))[0];

  await token.update({ [`flags.${MODULE_ID}.attached.${sound.soundId}`]: doc.id });

  if (setPosition) refreshSoundPosition(token);

  const duration = audio?.duration;
  if (duration && !doc.repeat) {
    setNonRepeatTicker(token, sound.soundId, Date.now() + duration * 1000 + 1000);
  }
}

export function refreshSoundPosition(token) {
  const scene = token.parent;
  if (!game.user.isGM) {
    const message = {
      handlerName: 'sound',
      args: { sceneId: scene.id, tokenId: token.id },
      type: 'POSITIONS',
    };
    game.socket?.emit(`module.${MODULE_ID}`, message);
    return;
  }

  const attached = token.getFlag(MODULE_ID, 'attached') ?? {};
  const ambientSounds = [];
  for (const [soundId, ambientSoundId] of Object.entries(attached)) {
    const ambientSound = scene.sounds.get(ambientSoundId);
    if (ambientSound) ambientSounds.push(ambientSound);
    else token.update({ [`flags.${MODULE_ID}.attached.-=${soundId}`]: null }); // Cleanup dangling attached sounds
  }

  if (ambientSounds.length) {
    const center = {
      x: token._source.x + (token.width * canvas.dimensions.size) / 2,
      y: token._source.y + (token.height * canvas.dimensions.size) / 2,
    };

    const updates = [];

    for (const ambientSound of ambientSounds) {
      updates.push({ _id: ambientSound.id, ...center });
    }
    scene.updateEmbeddedDocuments('AmbientSound', updates);
  }
}
