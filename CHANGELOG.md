# 2.1.0

**API**

- `SoundOfToken.play(...)`
- `SoundOfToken.stop(...);`
  - Plays/stops the sound assigned to the token actor matching the provided sound description
  - e.g. `SoundOfToken.play(_token, 'Drums');`
  - e.g. `SoundOfToken.stop(_token, 'Drums');`
  - First parameter accepts token id, token placeable, token document, or actor
  - Second parameter accepts the sound description which will be used to match the sound on the actor

# 2.0.0

- v12 support

# 1.2.1

- Fixed non-audio files causing UI freeze-up

# 1.2.0

- Sounds can now be sorted by dragging and dropping them on other sounds

# 1.1.2

- Fixed browser context menu popping up upon right-clicking sounds in the Token HUD

# 1.1.1

- Fixed Right-click on sounds causing Player Edit lock to toggle

# 1.1.0

- Token HUD button can now be Right-click to toggle Player editing
- Newly created tokens will no longer have attached `AmbientSounds` belonging to the copied token
- Fixed sounds triggered by players not properly clearing from non-repeat queue

# 1.0.0

- Initial release
