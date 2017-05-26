 #!/bin/bash

function buildProduction() {
  # clean build folder
  rm -rf ./build
  mkdir build
  cp -R public/* build/
  export NODE_ENV=production
  webpack --progress --profile --colors
}


# the first argument is the feature name of the branch
# the second argument is the commit/pull request message
function deploy() {
  # add default values to the 2 arguments
  feature_name=${1:-deploy-$RANDOM}
  message=${2:-auto deploy to github pages}

  # the branch that we're going to push all of the changes'
  new_branch_name=feature/$feature_name

  # get the current branch name
  branch_name=$(git symbolic-ref -q HEAD)
  branch_name=${branch_name##refs/heads/}
  branch_name=${branch_name:-HEAD}


  echo "\x1B[92starting to deploy"

  # checkout to a new feature branch
  git checkout -b $new_branch_name

  # add the changes in the public area
  git add build

  # commit the changes
  git commit -m "$message"

  # push the branch upstream
  git push -u

  # make and open the pull request
  hub pull-request -o -b gh-pages -m "$message"

  # checkout to the previous branch
  git checkout $branch_name

  # cleanup
  git branch -D $new_branch_name

  echo "\x1B[92mmerge the pull request in order to have this build deployed on github pages!"
}
