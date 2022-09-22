/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License")
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const Generator = require('yeoman-generator')
const path = require('path')
const upath = require('upath')
const fs = require('fs-extra')

const runtimeAction = require('./generator-add-action-cf-admin-ui')
const webAssets = require('./generator-add-web-assets-cf-admin-ui')

const {constants, utils} = require('@adobe/generator-app-common-lib')
const { runtimeManifestKey } = constants
const { briefOverviews, promptTopLevelFields, promptMainMenu } = require('./prompts')
const { readManifest, writeManifest } = require('./utils')

const EXTENSION_MANIFEST_PATH = path.join(process.cwd(), 'extension-manifest.json')

/*
'initializing',
'prompting',
'configuring',
'default',
'writing',
'conflicts',
'install',
'end'
*/

class MainGenerator extends Generator {
  constructor (args, opts) {
    super(args, opts)
    
    // options are inputs from CLI or yeoman parent generator
    this.option('skip-prompt', { default: false })
  }
  
  initializing () {
    // all paths are relative to root
    this.extFolder = 'src/aem/cf-console-admin-1'
    this.actionFolder = path.join(this.extFolder, 'actions')
    
    // todo support multi UI (could be one for each operation)
    this.webSrcFolder = path.join(this.extFolder, 'web-src')
    this.extConfigPath = path.join(this.extFolder, 'ext.config.yaml')
    this.configName = 'aem/cf-console-admin/1'
    // this.extFolder = path.join(this.extFolder, 'item-menu')

    this.extensionManifest = readManifest(EXTENSION_MANIFEST_PATH)
  }

  async prompting () {
    this.log(briefOverviews['templateInfo'])
    await promptTopLevelFields(this.extensionManifest)
      .then(() => promptMainMenu(this.extensionManifest))
      .then(() => writeManifest(this.extensionManifest, EXTENSION_MANIFEST_PATH))
      .then(() => {
        this.log("\Extension Manifest for Pre-generating Code")
        this.log("---------------------------------------")
        this.log(JSON.stringify(this.extensionManifest, null, '  '))
      })
  }

  async writing () {
    // generate the generic action
    if (this.extensionManifest.runtimeActions) {
      this.extensionManifest.runtimeActions.forEach((action) => {
        this.composeWith({
          Generator: runtimeAction,
          path: 'unknown'
        },
        {
          // forward needed args
          'skip-prompt': true, // do not ask for action name
          'action-folder': this.actionFolder,
          'config-path': this.extConfigPath,
          'full-key-to-manifest': runtimeManifestKey,
          'action-name': action.name,
          'extension-manifest': this.extensionManifest
        })
      })
    }

    // generate the UI
    this.composeWith({
      Generator: webAssets,
      path: 'unknown'
    }, 
    {
      'skip-prompt': this.options['skip-prompt'],
      'web-src-folder': this.webSrcFolder,
      'config-path': this.extConfigPath,
      'extension-manifest': this.extensionManifest,
    })

    const unixExtConfigPath = upath.toUnix(this.extConfigPath)
    // add the extension point config in root
    utils.writeKeyAppConfig(
      this,
      // key
      'extensions.' + this.configName,
      // value
      {
        // posix separator
        $include: unixExtConfigPath
      }
    )

    // add extension point operation
    utils.writeKeyYAMLConfig(
      this,
      this.extConfigPath,
      // key
      'operations', {
        view: [
          { type: 'web', impl: 'index.html' }
        ]
      }
    )

    // add actions path, relative to config file
    utils.writeKeyYAMLConfig(this, this.extConfigPath, 'actions', path.relative(this.extFolder, this.actionFolder))
    
    // add web-src path, relative to config file
    utils.writeKeyYAMLConfig(this, this.extConfigPath, 'web', path.relative(this.extFolder, this.webSrcFolder))
  }

  async conflicts () {
    const content = utils.readPackageJson(this)
    content['description'] = this.extensionManifest['description']
    content['version'] = this.extensionManifest['version']
    utils.writePackageJson(this, content)
  }

  async end () {
    this.log('\nSample code files have been generated.\n')
    this.log('Next steps:')
    this.log('1) Populate your local environment variables in the ".env" file')
    this.log('2) You can use `aio app run` or `aio app deploy` to see the sample code files in action')
    this.log('\n')
  }
}

module.exports = MainGenerator

