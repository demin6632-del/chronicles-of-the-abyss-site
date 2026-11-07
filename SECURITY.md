# Website and project security rules

This repository is a public GitHub Pages website. Files delivered to a visitor's browser (HTML, CSS, JavaScript, images, and downloadable game builds) can be inspected and copied. No browser-side technique can make public client-side code impossible to extract.

## Rules for future updates

- Never commit passwords, API keys, access tokens, private signing keys, recovery codes, or other secrets.
- Never upload the Godot editor project, source project folders, `.godot/` cache, editor metadata, private development notes, or debug logs to this public website repository.
- Publish only the intended website files and the exported game build.
- Do not publish source maps (`.map`) or development bundles unless there is a deliberate reason.
- Review every new file before committing it. Check archives and images for private data and unintended metadata.
- Keep a separate offline backup of the original project and important release files.
- Use a private repository or private storage for source code and secrets. A public GitHub Pages repository must be treated as public, even if the website itself is the only intended public interface.
- Keep third-party libraries and assets under their own licenses; this notice does not replace those licenses.

## Important limitation

Minification and obfuscation can make code harder to read, but they do not prevent copying. Disabling right-click, text selection, or developer tools is not real security and can be bypassed. Do not rely on those techniques to protect intellectual property.
