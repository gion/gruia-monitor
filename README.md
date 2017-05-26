# gruia-monitor
A baby monitor prototype app build using webrtc and firebase

## test it online at [gion.github.io/gruia-monitor/](gion.github.io/gruia-monitor/)

## install
  - clone the repo (`git clone git@github.com:gion/gruia-monitor.git`)
  - install the dependencies (`npm i`)

## run
  - `npm run serve` should do the trick

## build
  - `npm run build:dev` ... for building a local (dev) copy
  - `npm run build:dist` ... very intuitive, huh?

## deploy
  - `npm run deploy`

  Additionally, you can pass the **feature name** and the **commit/pull request message** to the deploy command:
  ```bash
  npm run deploy -- fancy-feature-name "this is the best commit message ever!"
  ```

  >Note that this webapp is hosted on github pages and in order to make a deploy, you need to push your changes to the [gh-pages branch](https://github.com/gion/gruia-monitor/tree/gh-pages)

## status
  - follow the status of this project online: [https://github.com/gion/gruia-monitor/projects/1](https://github.com/gion/gruia-monitor/projects/1)
  - browse through and post new issues at: [https://github.com/gion/gruia-monitor/issues](https://github.com/gion/gruia-monitor/issues)