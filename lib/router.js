'use strict';

var eventController = require('./api_controllers/event_controller');

function Router() {

}

Router.prototype.map = function (server) {
  server.route(eventController.routes);
};

module.exports = new Router();
