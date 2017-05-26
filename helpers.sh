 #!/bin/bash

function deploy() {
  echo "starting to deploy"
  git checkout -b feature/deploy-$RANDOM
  git add public
  git commit -m "auto deploy to github pages"
  git push -u
  hub pull-request -b github-pages
  echo "merge the pull request in order to have this build deployed on github pages!"
}
