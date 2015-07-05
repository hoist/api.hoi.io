var root = process.cwd();
module.exports = {
  js: {
    lib: [root + '/lib/**/*.js'],
    gulpfile: ['Gulpfile.js'],
    specs: ['tests/**/*.js', '!tests/fixtures/**/*']
  },
  specs: ['tests/**/*.js', '!tests/fixtures/**/*'],
  docs: [
    './docs/_root.md',
    './docs/*.md'
  ]
};
