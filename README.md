# Whatajong

Whatajong is an open source html5 multiplayer solitaire built with nodejs and socket.io.

![](https://github.com/masylum/whatajong/raw/master/public/images/preview.jpg)

You can try a hosted version at [fuckmahjong.com](http://www.fuckmahjong.com)

## Installation

```bash
git clone https://github.com/masylum/whatajong.git
npm install
cp default.conf.js conf.js
```

Edit the `conf.js` file with your specific configuration and you are ready to go!

## How does it work?

Half the game work in the client, and the other half in the server.
Both parts are communciated via socket.io exchanging `events` and `state`.
There is a file `public/js/tile.js` that works in the server and the client
so we can't give some instant feedback to the user.

```
.-----------.                   .-------------.
| Server    |                   | Browser 1   |
+-----------+                   +-------------+
|           |                   |             |
|           | <=== Events ======| public/js/* |
|           |                   |             |
|           |                   '-------------'
|           |
| serverjs  |===== State (broadcast) ====>
|           |
|           |                   .-------------.
|           |                   | Browser n   |
|           |                   +-------------+
|           |                   |             |
|           | <=== Events ======| public/js/* |
|           |                   |             |
'-----------'                   '-------------'
```

## MongoDB

Mongodb is used to store rooms and users.

## License
(The MIT License)

Copyright (C) 2011 Pau Ramon Revilla <masylum@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
