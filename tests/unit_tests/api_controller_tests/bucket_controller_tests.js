'use strict';
import Server from '../../../lib/server';
import config from 'config';
import sinon from 'sinon';
import Bluebird from 'bluebird';
import BucketController from '../../../lib/api_controllers/bucket_controller';
import errors from '@hoist/errors';
import BucketPipeline from '@hoist/bucket-pipeline';
import {
  expect
}
from 'chai';
import {
  _mongoose,
  Organisation,
  Application
}
from '@hoist/model';

Bluebird.promisifyAll(_mongoose);

/** @test {BucketController} */
describe('Bucket Routes', function () {
  let server;
  let application;
  before(function () {
    server = new Server();
    server._createServer();
    return Promise.all([
      _mongoose.connectAsync(config.get('Hoist.mongo.core.connectionString')),
      new Organisation({
        _id: 'orgid',
        name: 'test org',
        slug: 'org'
      }).saveAsync(),
      new Application({
        _id: 'appid2',
        organisation: 'orgid',
        name: 'test app',
        apiKey: 'apiKey',
        slug: 'app'
      }).saveAsync()
      .then((results) => {
        application = results[0];
      })
    ]);
  });
  after(function () {
    return Promise.all([
      Organisation.removeAsync(),
      Application.removeAsync()
    ]).then(function () {
      return _mongoose.disconnectAsync();
    });
  });
  describe('Sets up correct routes', () => {
    let mockServer = {
      route: sinon.stub()
    };
    let bucketController;
    before(() => {
      bucketController = new BucketController();
      return bucketController.mapRoutes(mockServer);
    });
    it('creates GET /bucket/{key}', () => {
      return expect(mockServer.route).to.have.been.calledWith({
        config: {
          auth: "hoist",
          bind: bucketController
        },
        handler: bucketController.getBucket,
        method: ["GET"],
        path: '/bucket/{key}'
      });
    });
  });
  describe('GET /bucket/{key}', function () {
    describe('with matching bucket', function () {
      var _response;
      var _bucket = {
        "key": "MOOSE",
        toObject: function () {
          return {
            "key": "MOOSE"
          };
        }
      };
      before(function (done) {
        sinon.stub(BucketPipeline.prototype, 'get', () => {
          return Promise.resolve(_bucket);
        });
        server._hapiServer.inject({
          method: 'GET',
          url: '/bucket/bucket-key',
          headers: {
            authorization: 'Hoist apiKey'
          }
        }, function (response) {
          _response = response;
          done();
        });
      });
      after(function () {
        BucketPipeline.prototype.get.restore();
      });
      it('returns the bucket JSON', function () {
        return expect(JSON.parse(_response.payload)).to.eql(JSON.parse(JSON.stringify(_bucket.toObject())));
      });
      it('sends correct context to pipeline', () => {
        return expect(BucketPipeline.prototype.get)
          .to.have.been.calledWith({
            application: application.toObject(),
            environment: 'live'
          }, 'bucket-key');
      });
      it('returns 200', function () {
        expect(_response.statusCode).to.eql(200);
      });
    });
    describe('with no matching bucket', function () {
      var _response;
      before(function (done) {
        sinon.stub(BucketPipeline.prototype, 'get').returns(Promise.resolve(null));
        server._hapiServer.inject({
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
      after(function () {
        BucketPipeline.prototype.get.restore();
      });
      it('responds with 404 NOT FOUND', function () {
        expect(_response.statusCode).to.eq(404);
      });
    });
    describe('with no bucket key supplied', function () {
      var _response;
      before(function (done) {
        sinon.stub(BucketPipeline.prototype, 'get').returns(Promise.resolve(null));
        server._hapiServer.inject({
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
      after(function () {
        BucketPipeline.prototype.get.restore();
      });
      it('responds with 404 NOT FOUND', function () {
        expect(_response.statusCode).to.eq(404);
      });
    });
    describe('with hoist err while getting bucket', function () {
      var _response;
      before(function (done) {
        sinon.stub(BucketPipeline.prototype, 'get').returns(Promise.reject(new errors.HoistError('TEST')));
        server._hapiServer.inject({
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
      after(function () {
        BucketPipeline.prototype.get.restore();
      });
      it('responds with 500', function () {
        expect(_response.statusCode).to.eq(500);
      });
    });
    describe('with non hoist err while getting bucket', function () {
      var _response;
      before(function (done) {
        sinon.stub(BucketPipeline.prototype, 'get').returns(Promise.reject({}));
        server._hapiServer.inject({
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
      after(function () {
        BucketPipeline.prototype.get.restore();
      });
      it('responds with 500', function () {
        expect(_response.statusCode).to.eq(500);
      });
    });
  });
});
