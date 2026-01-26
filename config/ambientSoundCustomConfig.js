import { MODULE_ID } from '../token-sounds.js';

export async function openCustomConfig(data, dataSource, create = true) {
  return new AmbientSoundCustomConfig(data, dataSource, create).render(true);
}

class AmbientSoundCustomConfig extends foundry.applications.sheets.AmbientSoundConfig {
  constructor(data, dataSource, create = true) {
    const sound = new AmbientSoundDocument(foundry.utils.deepClone(data), { parent: canvas.scene });
    const options = {
      document: sound,
      actions: {
        sotSubmit: AmbientSoundCustomConfig.submit,
        sotRemove: AmbientSoundCustomConfig.remove,
      },
    };

    super(options);
    this.create = create;
    this.soundData = data;
    this.dataSource = dataSource;
  }

  /** @override */
  get isEditable() {
    // Trick the sheet into being editable by players
    return true;
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
    // Remove unnecessary controls
    this.element.querySelectorAll('[name="x"], [name="y"]').forEach((el) => el.closest('.form-group').remove());

    this.insertAdditionalControls();

    this.element.querySelector('.file-picker[data-target="img"]').addEventListener('click', () => {
      new foundry.applications.apps.FilePicker.implementation({
        type: 'image',
        callback: (path) => {
          const el = this.element.querySelector('[name="img"]');
          el.value = path;
          el.dispatchEvent(new Event('change'));
        },
      }).render();
    });

    return super._onRender(...args);
  }

  /** @override */
  async _onSubmitForm(formConfig, event) {
    event.preventDefault();
    await this.close({ submitted: true });
  }

  _getSubmitData() {
    const form = this.element;
    const formData = new foundry.applications.ux.FormDataExtended(form);
    const submitData = foundry.utils.expandObject(formData.object);
    return submitData;
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

  async insertAdditionalControls() {
    const icon = this.soundData.img ?? 'icons/svg/sound.svg';
    const soundId = this.soundData.soundId ?? foundry.utils.randomID();
    const description = this.soundData.description ?? '';
    const repeat = this.soundData.repeat;

    // Insert img, description and hidden id fields
    const standardForm = this.element.querySelector('.standard-form');
    $(standardForm).prepend(`
  <fieldset>
    <legend>Sound of Token</legend>
    <input type="text" name="soundId" value="${soundId}" hidden>
    <div class="form-group">
      <label>Icon</label>
      <div class="form-fields">
          <input type="text" name="img" value="${icon}">
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
  }
}
