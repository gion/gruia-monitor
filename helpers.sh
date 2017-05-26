 #!/bin/bash

function deploy() {

  # get the current branch name
  branch_name=$(git symbolic-ref -q HEAD)
  branch_name=${branch_name##refs/heads/}
  branch_name=${branch_name:-HEAD}

  echo "starting to deploy"

  # checkout to a new feature branch
  git checkout -b feature/deploy-$RANDOM

  # add the changes in the public area
  git add public

  # commit the changes
  git commit -m "auto deploy to github pages"

  # push the branch upstream
  git push -u

  # make and open the pull request
  hub pull-request -o -b gh-pages

  # checkout to the previous branch
  git checkout $branch_name

  echo "merge the pull request in order to have this build deployed on github pages!"
}
