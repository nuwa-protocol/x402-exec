# xdefi.app

React + Vite + TypeScript app using shadcn/ui.

## Getting Started

```bash
npx degit hayyi2/react-shadcn-starter my-project
cd my-project
npm install
npm run dev
```

## Getting Done

- [x] Single page app with navigation and responsif layout
- [x] Customable configuration `/config`
- [x] Simple starting page/feature `/pages`
- [x] Github action deploy github pages

## Deploy `gh-pages`

- change `basenameProd` in `/vite.config.ts`
- create deploy key `GITHUB_TOKEN` in github `/settings/keys`
- commit and push changes code
- setup gihub pages to branch `gh-pages`
- run action `Build & Deploy`

### Auto Deploy

- change file `.github/workflows/build-and-deploy.yml`
- Comment on `workflow_dispatch`
- Uncomment on `push`

```yaml
# on:
#   workflow_dispatch:
on:
  push:
    branches: ["main"]
```

## Features

- React + Vite + TypeScript
- Tailwind CSS
- [shadcn-ui](https://github.com/shadcn-ui/ui/)
- [react-router-dom](https://www.npmjs.com/package/react-router-dom)

### Wallet Connection (AppKit + viem)

This app includes wallet connection via WalletConnect AppKit (wagmi/viem).

Environment variable required at runtime:

```
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

Create a project id at https://cloud.walletconnect.com.

## Project Structure

```md
react-shadcn-starter/
├── public/            # Public assets
├── src/               # Application source code
│   ├── components/    # React components
│   ├── context/       # contexts components
│   ├── config/        # Config data
│   ├── hook/          # Custom hooks
│   ├── lib/           # Utility functions
│   ├── pages/         # pages/features components
│   ├── App.tsx        # Application entry point
│   ├── index.css      # Main css and tailwind configuration
│   ├── main.tsx       # Main rendering file
│   └── Router.tsx     # Routes component
├── index.html         # HTML entry point
├── tsconfig.json      # TypeScript configuration
└── vite.config.ts     # Vite configuration
```

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/hayyi2/react-shadcn-starter/blob/main/LICENSE) file for details.
