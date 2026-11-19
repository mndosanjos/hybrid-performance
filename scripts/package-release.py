"""Create source and static-hosting ZIPs without collecting personal data."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
release = root / 'release'
release.mkdir(exist_ok=True)
folders = ['src', 'public', 'scripts', '.github']
files = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'index.html',
         'tsconfig.json', 'vite.config.ts', '.gitignore', 'README.md',
         'VERIFICATION.md', 'START-HYBRID.cmd']
with ZipFile(release / 'Hybrid-Performance-Source.zip', 'w', ZIP_DEFLATED) as archive:
    for folder in folders:
        for path in sorted((root / folder).rglob('*')):
            if path.is_file():
                archive.write(path, path.relative_to(root))
    for name in files:
        archive.write(root / name, name)
with ZipFile(release / 'Hybrid-Performance-Static.zip', 'w', ZIP_DEFLATED) as archive:
    for path in sorted((root / 'dist').rglob('*')):
        if path.is_file():
            archive.write(path, path.relative_to(root / 'dist'))
for path in sorted(release.glob('*.zip')):
    print(f'{path.name}: {path.stat().st_size:,} bytes')
