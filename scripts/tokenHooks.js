import { openCustomConfig } from '../config/ambientSoundCustomConfig.js';
import { MODULE_ID, stopSounds, playSounds, refreshSoundPosition, deleteToken } from '../token-sounds.js';

export function registerTokenHooks() {
  Hooks.on('canvasReady', () => {
    if (game.user.isGM) {
      for (const token of canvas.tokens.placeables) {
        playSounds(token.document);
      }
    }
  });

  // Making sure new tokens don't point to the previous token's attached AmbientSounds
  Hooks.on('preCreateToken', (token, data, options, userId) => {
    if (game.user.id === userId && data.flags?.[MODULE_ID]?.attached) {
      token.updateSource({ [`flags.${MODULE_ID}.-=attached`]: null });
    }
  });

  Hooks.on('createToken', (token, opts, userId) => {
    if (game.user.id === userId) playSounds(token);
  });

  Hooks.on('deleteToken', (token, opts, userId) => {
    if (game.user.id === userId) deleteToken(token);
  });

  Hooks.on('updateToken', async (token, change, options, userId) => {
    if (game.user.id === userId) {
      const flags = change.flags?.[MODULE_ID];
      if (flags) {
        if (flags.sounds) {
          for (const soundId of Object.keys(flags.sounds)) {
            if (soundId.startsWith('-=')) stopSounds(token, [soundId.substring(2)]);
            else {
              stopSounds(token, [soundId]);
              playSounds(token, [soundId]);
            }
          }
        }

        if (flags.playing) {
          for (const [soundId, play] of Object.entries(flags.playing)) {
            if (soundId.startsWith('-=')) stopSounds(token, [soundId.substring(2)]);
            else if (!play) stopSounds(token.id, [soundId]);
            else playSounds(token, [soundId]);
          }
        }
      }
      if ('x' in change || 'y' in change || 'width' in change || 'height' in change) {
        refreshSoundPosition(token);
      }
    }
  });

  Hooks.on('updateActor', async (actor, change, options, userId) => {
    if (game.user.id === userId) {
      if (change.flags?.[MODULE_ID]) {
        actor.getActiveTokens(false, true).forEach((t) => {
          stopSounds(t);
          playSounds(t);
        });
      }
    }
  });

  Hooks.on('renderTokenHUD', (hud, html, token) => {
    if (!hud._soundBoard || hud._soundBoard.id !== hud.object.id)
      hud._soundBoard = { id: hud.object.id, active: false };

    const actor = game.actors.get(token.actorId);
    if (!actor) return;
    const sounds = actor.getFlag(MODULE_ID, 'sounds');
    const allowPlayerEdit = actor.getFlag(MODULE_ID, 'allowPlayerEdit');
    if (!(game.user.isGM || allowPlayerEdit) && foundry.utils.isEmpty(sounds)) return;

    const playing = !foundry.utils.isEmpty(foundry.utils.getProperty(token, `flags.${MODULE_ID}.playing`));
    const title = game.user.isGM ? 'Right-click to enable Player editing.' : '';

    const button = $(`
      <div class="control-icon token-sounds ${playing ? 'playing' : ''}" data-action="token-sounds" title="${title}">
        <i class="toggle-edit fas fa-waveform-path"></i>
        ${allowPlayerEdit && game.user.isGM ? '<i class="player-edit fa-solid fa-unlock-keyhole fa-2xs"></i>' : ''}
      </div>
    `);
    html.find('div.right').last().append(button);
    button.click((event) => _onButtonClick(event, token, hud));
    if (game.user.isGM) {
      button.find('.toggle-edit').contextmenu((event) => {
        const allowPlayerEdit = actor.getFlag(MODULE_ID, 'allowPlayerEdit');
        actor.setFlag(MODULE_ID, 'allowPlayerEdit', !allowPlayerEdit);
      });
    }

    if (hud._soundBoard.id === hud.object.id && hud._soundBoard.active) {
      button.trigger('click');
    }
  });
}

//
// Token HUD functions
//

async function _onButtonClick(event, token, hud) {
  const button = $(event.target).closest('.control-icon');
  token = canvas.tokens.placeables.find((t) => t.id === token._id)?.document;

  // De-activate 'Status Effects'
  button.closest('div.right').find('div.control-icon.effects').removeClass('active');
  button.closest('div.right').find('.status-effects').removeClass('active');

  // Toggle menu
  button.toggleClass('active');

  hud._soundBoard.active = button.hasClass('active');

  let wrapper = button.find('.token-sounds-wrapper');
  if (button.hasClass('active')) {
    if (!wrapper.length) {
      wrapper = await renderMenu(token);
      if (wrapper) button.find('i').after(wrapper);
      else return;
    }
    wrapper.addClass('active');
  } else {
    wrapper.removeClass('active');
  }

  wrapper
    .find('.sound.editable')
    .on('contextmenu', (event) => _onSoundRightClick(event, game.actors.get(token.actorId)));
  wrapper.find('.add-sound').on('click', (event) => _onAddSoundClick(event, game.actors.get(token.actorId)));

  const sounds = wrapper.find('.sound');
  sounds.on('click', (event) => _onSoundClick(event, token));

  // ==================
  // Dragging and sorting sounds
  let draggedSoundId;
  sounds.on('dragstart', (event) => {
    draggedSoundId = $(event.target).closest('.sound').data('soundId');
  });
  sounds.on('dragover', (event) => {
    const sound = $(event.target).closest('.sound');
    if (sound.data('soundId') === draggedSoundId) return;

    // Determine if mouse is hovered to the left or right
    var domRect = event.currentTarget.getBoundingClientRect();
    let prc = event.offsetX / domRect.width;
    if (prc < 0.2) {
      sound.removeClass('drag-right').addClass('drag-left');
    } else {
      sound.removeClass('drag-left').addClass('drag-right');
    }
  });
  sounds.on('dragleave', (event) => {
    $(event.target).closest('.sound').removeClass('drag-left').removeClass('drag-right');
  });
  sounds.on('drop', (event) => {
    const sound = $(event.target).closest('.sound');
    _onSoundOrder(draggedSoundId, sound.data('soundId'), game.actors.get(token.actorId), sound.hasClass('drag-left'));

    $(event.target).closest('.sound').removeClass('drag-left').removeClass('drag-right');
  });
  // End of dragging and sorting sounds
  // ===================================
}

function _onSoundRightClick(event, dataSource) {
  if (!dataSource) return;
  const soundId = $(event.target).closest('.sound').data('sound-id');
  const sound = (dataSource.getFlag(MODULE_ID, 'sounds') ?? {})[soundId];
  if (sound) openCustomConfig(sound, dataSource, false);
}

function _onAddSoundClick(event, dataSource) {
  event.stopPropagation();
  if (dataSource) openCustomConfig({}, dataSource, true);
}

async function renderMenu(token) {
  const playing = token.getFlag(MODULE_ID, 'playing') ?? {};

  const actor = game.actors.get(token.actorId);
  if (!actor) return;
  const sounds = Object.values(foundry.utils.deepClone(actor.getFlag(MODULE_ID, 'sounds') ?? {})).sort(
    (s1, s2) => (s1.sort ?? 0) - (s2.sort ?? 0)
  );

  sounds.forEach((s) => {
    s.playing = s.soundId in playing;
    if (!s.img) s.img === 'icons/svg/sound.svg';
  });

  const allowPlayerEdit = actor.getFlag(MODULE_ID, 'allowPlayerEdit');

  const editable = game.user.isGM || allowPlayerEdit;

  const menu = $(
    await renderTemplate('modules/aedifs-token-sounds/templates/soundBoard.html', {
      sounds,
      editable,
    })
  );
  return menu;
}

function _onSoundClick(event, token) {
  event.stopPropagation();
  if (!token) return;

  const soundId = $(event.target).closest('.sound').data('sound-id');
  if (!soundId) return;

  const playing = (token.getFlag(MODULE_ID, 'playing') ?? {})[soundId];
  const update = {};

  if (playing) update[`flags.${MODULE_ID}.playing.-=` + soundId] = null;
  else update[`flags.${MODULE_ID}.playing.` + soundId] = true;

  token.update(update);
}

function _onSoundOrder(sourceId, targetId, actor, sortBefore = false) {
  if (!(sourceId && targetId && actor)) return;
  if (sourceId === targetId) return;

  const sounds = Object.values(actor.getFlag(MODULE_ID, 'sounds') ?? {});

  const source = sounds.find((s) => s.soundId === sourceId);
  const target = sounds.find((s) => s.soundId === targetId);
  if (!(source && target)) return;

  const siblings = sounds.filter((s) => s.soundId !== sourceId);
  const result = SortingHelpers.performIntegerSort(source, { target, siblings, sortBefore });

  if (result.length) {
    const update = {};
    for (const r of result) {
      update[r.target.soundId] = r.update;
    }
    actor.update({ [`flags.${MODULE_ID}.sounds`]: update });
  }
}
