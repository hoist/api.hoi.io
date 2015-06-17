'use strict';
require('../../bootstrap');
var Server = require('../../../lib/server');
var expect = require('chai').expect;
var Model = require('hoist-model');
var BBPromise = require('bluebird');
var mongoose = BBPromise.promisifyAll(Model._mongoose);
var config = require('config');
var sinon = require('sinon');
var pipeline = require('hoist-bucket-pipeline').Pipeline;
var errors = require('hoist-errors');
var _ = require('lodash');
var bucketController = require('../../../lib/api_controllers/bucket_controller');

describe('Bucket Routes', function () {
  var server;
  before(function () {
    server = Server.createServer();
    return BBPromise.all([
      mongoose.connectAsync(config.get('Hoist.mongo.db')),
      new Model.Organisation({
        _id: 'orgid',
        name: 'test org',
        slug: 'org'
      }).saveAsync(),
      new Model.Application({
        _id: 'appid2',
        organisation: 'orgid',
        name: 'test app',
        apiKey: 'apiKey',
        slug: 'app'
      }).saveAsync()
    ]);
  });
  after(function () {
    return BBPromise.all([
      Model.Organisation.removeAsync(),
      Model.Application.removeAsync()
    ]).then(function () {
      return mongoose.disconnectAsync();
    });
  });
  describe('Has GET /bucket/{key} avaliable', function() {
    it('has matching path', function() {
      var r = _.find(bucketController.getRoutes(), function(item) { return item.path === "/bucket/{key}";}) || {};
      expect(r.path).to.eql("/bucket/{key}");
    });
  });
  describe('GET /bucket/{key}', function () {
    describe('with matching bucket', function () {
      var _response;
      var _bucket = {"key":"MOOSE", toObject:function(){return {"key":"MOOSE"};}};
      before(function (done) {
        sinon.stub(pipeline.prototype, 'get').returns(BBPromise.resolve(_bucket));
        server.inject({
          method: 'GET',
          url: '/bucket/eventid',
          headers: {
            authorization: 'Hoist apiKey'
          }
        }, function (response) {
          _response = response;
          done();
        });
      });
      after(function() {
        pipeline.prototype.get.restore();
      });
      it('returns the bucket JSON', function() {
        expect(JSON.parse(_response.payload)).to.eql(JSON.parse(JSON.stringify(_bucket.toObject())));
      });
      it('returns 200', function() {
        expect(_response.statusCode).to.eql(200);
      });
    });
    describe('with no matching bucket', function() {
      var _response;
      before(function (done) {
        sinon.stub(pipeline.prototype, 'get').returns(BBPromise.resolve(null));
        server.inject({
          method: 'GET',
          url: '/bucket/eventid',
          headers: {
            authorization: 'Hoist apiKey'
          }
        }, function (response) {
          _response = response;
          done();
        });
      });
      after(function() {
        pipeline.prototype.get.restore();
      });
      it('responds with 404 NOT FOUND', function() {
        expect(_response.statusCode).to.eq(404);
      });
    });
    describe('with no bucket key supplied', function() {
      var _response;
      before(function (done) {
        sinon.stub(pipeline.prototype, 'get').returns(BBPromise.resolve(null));
        server.inject({
          method: 'GET',
          url: '/bucket/',
          headers: {
            authorization: 'Hoist apiKey'
          }
        }, function (response) {
          _response = response;
          done();
        });
      });
      after(function() {
        pipeline.prototype.get.restore();
      });
      it('responds with 404 NOT FOUND', function() {
        expect(_response.statusCode).to.eq(404);
      });
    });
    describe('with hoist err while getting bucket', function() {
      var _response;
      before(function (done) {
        sinon.stub(pipeline.prototype, 'get').returns(BBPromise.reject(new errors.hoistError('TEST')));
        server.inject({
          method: 'GET',
          url: '/bucket/eventid',
          headers: {
            authorization: 'Hoist apiKey'
          }
        }, function (response) {
          _response = response;
          done();
        });
      });
      after(function() {
        pipeline.prototype.get.restore();
      });
      it('responds with 500', function() {
        expect(_response.statusCode).to.eq(500);
      });
    });
    describe('with non hoist err while getting bucket', function() {
      var _response;
      before(function (done) {
        sinon.stub(pipeline.prototype, 'get').returns(BBPromise.reject({}));
        server.inject({
          method: 'GET',
          url: '/bucket/eventid',
          headers: {
            authorization: 'Hoist apiKey'
          }
        }, function (response) {
          _response = response;
          done();
        });
      });
      after(function() {
        pipeline.prototype.get.restore();
      });
      it('responds with 500', function() {
        expect(_response.statusCode).to.eq(500);
      });
    });
  });
});
