import { MODULE_ID, playSounds, stopSounds } from '../token-sounds.js';

export class SoundOfToken {
  static async play(token, description) {
    if (!description) throw Error('No sound description provided.');

    const tokens = _getTokens(token);
    for (const token of tokens) {
      const dataSource = game.actors.get(token.actorId) ?? token;
      const sounds = dataSource.getFlag(MODULE_ID, 'sounds') ?? {};

      let soundId = Object.keys(sounds).find((id) => sounds[id].description === description);

      token.update({ [`flags.${MODULE_ID}.playing.${soundId}`]: true });
    }
  }

  static async stop(token, description) {
    if (!description) throw Error('No sound description provided.');

    const tokens = _getTokens(token);
    for (const token of tokens) {
      const dataSource = game.actors.get(token.actorId) ?? token;
      const sounds = dataSource.getFlag(MODULE_ID, 'sounds') ?? {};

      let soundId = Object.keys(sounds).find((id) => sounds[id].description === description);
      token.update({ [`flags.${MODULE_ID}.playing.-=${soundId}`]: null });
    }
  }
}

function _getTokens(token) {
  if (foundry.utils.getType(token) === 'string') token = canvas.tokens.get(token);

  let tokens;
  if (token instanceof Token) token = token.document;
  if (token instanceof TokenDocument) tokens = [token];
  else if (token instanceof Actor) tokens = actor.getActiveTokens(false, true);

  if (!tokens) throw Error(`Invalid token/actor. Unable to play sound: ${description}`);

  return tokens;
}
