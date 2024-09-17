import { MODULE_ID } from '../token-sounds.js';

export async function openCustomConfig(data, dataSource, create = true) {
  return new AmbientSoundCustomConfig(data, dataSource, create).render(true);
}

class AmbientSoundCustomConfig extends AmbientSoundConfig {
  constructor(data, dataSource, create = true) {
    const sound = new AmbientSoundDocument(foundry.utils.deepClone(data), { parent: canvas.scene });
    const options = {
      document: sound,
      actions: {
        sotSubmit: AmbientSoundCustomConfig.submit,
        sotRemove: AmbientSoundCustomConfig.remove,
      },
    };

    // // Trick the sheet into being editable by players
    // Object.defineProperty(sound, 'isOwner', {
    //   get: function () {
    //     return true;
    //   },
    // });

    super(options);
    this.create = create;
    this.soundData = data;
    this.dataSource = dataSource;
  }

  static async submit() {
    let formData = this._getSubmitData();
    const update = { [`flags.${MODULE_ID}.sounds.${formData.soundId}`]: foundry.utils.expandObject(formData) };
    this.dataSource.update(update);
  }

  static async remove() {
    let formData = this._getSubmitData();
    const update = { [`flags.${MODULE_ID}.sounds.-=${formData.soundId}`]: null };
    this.dataSource.update(update);
  }

  get isVisible() {
    return true;
  }

  get title() {
    if (this.create) return 'Create New Sound';
    else return 'Update Sound';
  }

  get id() {
    return `ambient-sound-custom-config-${this.document.id}`;
  }

  _onRender(...args) {
    const html = $(this.element);

    // Remove unnecessary controls
    html.find('[name="x"], [name="y"]').closest('.form-group').remove();

    this.insertAdditionalControls(html);

    html.find('.file-picker[data-target="img"]').on('click', () => {
      new FilePicker({
        type: 'image',
        callback: (path) => {
          html.find('[name="img"]').val(path).trigger('change');
        },
      }).render();
    });

    return super._onRender(...args);
  }

  _getSubmitData() {
    const form = this.element;
    const formData = new FormDataExtended(form);
    const submitData = foundry.utils.expandObject(formData.object);
    return submitData;
  }

  _getFormBody(html) {
    return html.find('.form-body');
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const buttons = [];
    if (this.create) {
      buttons.push({
        type: 'submit',
        icon: 'far fa-save',
        label: 'Create',
        action: 'sotSubmit',
      });
    } else {
      buttons.push({
        type: 'submit',
        icon: 'far fa-save',
        label: 'Update',
        action: 'sotSubmit',
      });

      buttons.push({
        type: 'submit',
        icon: 'far fa-trash',
        label: 'Remove',
        action: 'sotRemove',
      });
    }

    context.buttons = buttons;
    return context;
  }

  async insertAdditionalControls(html) {
    const icon = this.soundData.img ?? 'icons/svg/sound.svg';
    const soundId = this.soundData.soundId ?? foundry.utils.randomID();
    const description = this.soundData.description ?? '';
    const repeat = this.soundData.repeat;

    let tvaButton = '';
    if (game.modules.get('token-variants')?.active) {
      tvaButton = `<button class="token-variants-image-select-button" type="button" data-type="imagevideo" data-target="img" title="Select variant"><i class="fas fa-images"></i></button>`;
    }

    // Insert img, description and hidden id fields
    const formBody = this._getFormBody(html);
    formBody.prepend(`
  <fieldset>
    <legend>Sound of Token</legend>
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
  </fieldset>
`);

    if (tvaButton) {
      formBody.find('.token-variants-image-select-button').on('click', (event) => {
        const target = $(event.target).data('target');
        game.modules.get('token-variants').api.showArtSelect(formBody.find('[name="description"]').val(), {
          searchType: 'Item',
          callback: (imgSrc) => formBody.find(`[name="${target}"]`).val(imgSrc),
        });
      });
    }
  }
}
