# Firefox OS Physical Web

![Searching for beacons](images/screenshot.png)

This is a rudimentary physical web application for Firefox OS.

## Todo

1. Add Eddystone, only does URIBeacons right now
2. Sort based on RSSI, rather than time found
3. Maybe remove beacons that go out of range for X seconds

## Running tests

Tests run via [mocha](https://mochajs.org/). Node.js is not required for running the application.

1. Run `npm install` to install dependencies
2. Run `npm test` to run tests once
3. Run `npm run watch` to run tests and have a file watcher on it too
