## The thing

This repo contains the result of 14-hour work streak for [Realtime GameJam](http://2013.chaosconstructions.ru/party/realtime#8) on [Chaos Constructions 2013](http://2013.chaosconstructions.ru/). This game won the contest :)

The repo contains all build scripts which was used to build the game.

To play the game (the version is exactly as it was submitted to the contest), [follow the link](http://quyse.github.io/theman2013/game-cc2013).

## Requirements

Browser with WebGL support.

## Running up

You need [node.js](http://nodejs.org/).

```bash
# checkout repo
git checkout git@github.com:quyse/theman2013.git
cd theman2013
# install ice
cd build
mkdir node_modules
cd node_modules
git clone git@github.com:quyse/ice.git
# install other build dependencies
cd ..
npm install -d
# install main dependencies
cd ..
npm install -d
# build the thing
./bin/build-production
# run the server
node .
```
