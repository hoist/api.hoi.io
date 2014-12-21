'use strict';
require('../bootstrap');
var server = require('../../lib/server');
var sinon = require('sinon');
var BBPromise = require('bluebird');
var Model = require('hoist-model');
var mongoose = Model._mongoose;
var expect = require('chai').expect;
var config = require('config');
var router = require('../../lib/router');

describe('Server', function () {

  before(function () {


  });
  describe('#start', function () {
    var hapiServer = {
      start: sinon.stub().yields()
    };
    before(function () {
      sinon.stub(server, 'createServer').returns(BBPromise.promisifyAll(hapiServer));
      sinon.stub(mongoose, 'connect').yields();
      return server.start();
    });
    after(function () {
      server.createServer.restore();
      mongoose.connect.restore();
      delete server.server;
    });
    it('creates server', function () {
      return expect(server.createServer).to.have.been.called;
    });
    it('starts listening', function () {
      return expect(hapiServer.start).to.have.been.called;
    });
    it('opens mongodb connection', function () {
      return expect(mongoose.connect).to.have.been.calledWith(config.get('Hoist.mongo.db'));
    });
  });
  describe('#stop', function () {
    var hapiServer = {
      stop: sinon.stub().yields()
    };
    before(function () {
      server.server = BBPromise.promisifyAll(hapiServer);
      sinon.stub(mongoose, 'disconnect').yields();
      return server.stop();
    });
    after(function () {
      mongoose.disconnect.restore();
      delete server.server;
    });
    it('stops listening', function () {
      return expect(hapiServer.stop).to.have.been.called;
    });
    it('closes mongodb connection', function () {
      return expect(mongoose.disconnect).to.have.been.called;
    });
  });
  describe('#createServer', function () {
    var hapiServer;
    before(function () {
      sinon.stub(router, 'map');
      hapiServer = server.createServer();
    });
    after(function () {
      router.map.restore();
    });
    it('returns a promisifiedServer', function () {
      return expect(hapiServer).to.respondTo('startAsync');
    });
    it('configures correct port', function () {
      return expect(hapiServer.info.port).to.eql(8000);
    });
    it('maps routes', function () {
      return expect(router.map).to.have.been.called;
    });
  });
});
