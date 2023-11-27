import { MODULE_ID } from '../token-sounds.js';

export default class AmbientSoundCustomConfig extends AmbientSoundConfig {
  constructor(data, dataSource, create = true) {
    super(new AmbientSoundDocument(deepClone(data)), {});
    this.create = create;
    this.soundData = data;
    this.dataSource = dataSource;
  }

  get title() {
    if (this.create) return 'Create New Sound';
    else return 'Update Sound';
  }

  async _updateObject(event, formData) {
    const action = event.submitter?.value;
    formData = expandObject(formData);

    const update = {};
    if (action === 'create' || action === 'update') {
      update[formData.soundId] = formData;
    } else if (action === 'remove') {
      update['-=' + formData.soundId] = null;
    }

    const temp = { flags: {} };
    temp.flags[MODULE_ID] = { sounds: update };
    this.dataSource.update(temp);
  }

  async activateListeners(html) {
    // Remove x and y fields and submit button
    html.find('[name="x"], [name="y"]').closest('.form-group').remove();
    html.find('button[type="submit"]').remove();

    const icon = this.soundData.img ?? 'icons/svg/sound.svg';
    const soundId = this.soundData.soundId ?? randomID();
    const description = this.soundData.description ?? '';
    const repeat = this.soundData.repeat;

    let tvaButton = '';
    if (game.modules.get('token-variants')?.active) {
      tvaButton = `<button class="token-variants-image-select-button" type="button" data-type="imagevideo" data-target="img" title="Select variant"><i class="fas fa-images"></i></button>`;
    }

    // Insert img, description and hidden id fields
    html.prepend(`
    <input type="text" name="soundId" value="${soundId}" hidden>
    <div class="form-group">
      <label>Icon</label>
      <div class="form-fields">
          <input type="text" name="img" value="${icon}">
          ${tvaButton}
          <button type="button" class="file-picker" data-type="image" data-target="img" title="Browse Files" tabindex="-1"><i class="fas fa-file-import fa-fw"></i></button>
      </div>
    </div>
    <div class="form-group">
      <label>Description</label>
      <div class="form-fields">
          <input type="text" name="description" value="${description}">
      </div>
    </div>
    <div class="form-group">
      <label>Repeat</label>
      <div class="form-fields">
        <input type="checkbox" name="repeat" data-dtype="Boolean" ${repeat ? 'checked' : ''}>
      </div>
    </div>   
`);

    // Insert action type appropriate buttons
    let buttons;
    if (this.create) {
      buttons = $(
        '<button type="submit" value="create"><i class="far fa-save"></i> Create</button>'
      );
    } else {
      buttons = $(
        '<button type="submit" value="update"><i class="far fa-save"></i> Update</button><button type="submit" value="remove"><i class="far fa-trash"></i> Remove</button>'
      );
    }

    if (tvaButton) {
      html.find('.token-variants-image-select-button').on('click', (event) => {
        const target = $(event.target).data('target');
        game.modules
          .get('token-variants')
          .api.showArtSelect(html.find('[name="description"]').val(), {
            searchType: 'Item',
            callback: (imgSrc) => html.find(`[name="${target}"]`).val(imgSrc),
          });
      });
    }

    html.append(buttons);
    await super.activateListeners(html);
  }

  get id() {
    return `ambient-sound-custom-config-${this.object.id}`;
  }

  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();
    return buttons;
  }
}
