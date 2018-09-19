/**
 * Copyright 2017, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

// [START functions_imagemagick_setup]
const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');
const storage = require('@google-cloud/storage')();
const gm = require('gm').subClass({imageMagick: true});

const bucket = "mikeh";
const option = "!"
const quality = 90

// [END functions_imagemagick_setup]

// [START functions_imagemagick_analyze]
// Blurs uploaded images that are flagged as Adult or Violence.
exports.createImageSizesFromOriginal = (req, res) => {
  const filename = req.query.f;
  const width = req.query.width;
  const height = req.query.height;

  if(!filename) {
    res.sendStatus(400).send("No file specified");;
    return;
  }

  const dir = path.dirname(filename)
  const sFile = storage.bucket(bucket).file(filename);
  const bucketFilePath = `gs://${bucket}/${filename}`;

  console.log(`Starting to process File: ${bucketFilePath} width=${width} height=${height}`);

  let stream = sFile.createReadStream()

  stream.on('error', function(err) {
    console.error(err);
    res.sendStatus(err.code).end(err);
  });

  gm(stream)
    .resize(width, height, ">")
    .quality(quality)
    .stream()
    .pipe(res);

  // createImage(sFile, width, height, res)
  //   .catch((err) => {
  //     console.error(`After createImage: Failed to create image`, err);
  //     return Promise.reject(err);
  //   })
  //   .then(() => {
  //     res.send(`Images created successfully`);
  //   });

};
// [END functions_imagemagick_analyze]

// [START functions_imagemagick_blur]
// Creates a new image with given dimensions file using ImageMagick.
function createImage (sFile, width, height, res) {
  const filename = path.parse(sFile.name).base
  const dir = path.parse(sFile.name).dir
  const tempLocalFilename = `/tmp/${filename}`;
  const tempNewLocalFilename = path.join('/tmp', `s-${width}-${height}-${filename}`);
  const newFileName =  `s-${width}-${height}-${filename}`;

  console.log(`About to download file: ${tempLocalFilename}`);
  // Download file from bucket.
  return sFile.download({ destination: tempLocalFilename })
    .catch((err) => {
      console.error('Failed to download file.', err);
      return Promise.reject(err);
    })
    .then(() => {
      console.log(`Image ${sFile.name} has been downloaded to ${tempLocalFilename}.`);

      // Blur the image using ImageMagick.
      return new Promise((resolve, reject) => {
        var command = `convert ${tempLocalFilename}  -strip -interlace Plane -quality 95 -resize ${width}x${height}> ${tempNewLocalFilename}`
        command = command.replace(/>/g, "\\>")
        //res.send(command);
        console.log(`Executing: ${command}`);
        exec(command, { stdio: 'ignore' }, (err, stdout) => {
          if (err) {
            console.error('Failed to blur image.', err);
            reject(err);
          } else {
            resolve(stdout);
          }
        });
      });
    })
    .then(() => {
      console.log(`Image ${tempNewLocalFilename} has been resized.`);
      // Upload the Blurred image back into the bucket.
      return sFile.bucket.upload(tempNewLocalFilename, { destination: path.join(dir, newFileName) })
        .catch((err) => {
          console.error('Failed to upload blurred image.', err);
          return Promise.reject(err);
        });
    })
    .then(() => {
      console.log(`Resized image has been uploaded to ${newFileName}.`);

      // Delete the temporary file.
      // return new Promise((resolve, reject) => {
      //   fs.unlink(tempLocalFilename, (err) => {
      //     if (err) {
      //       reject(err);
      //     } else {
      //       resolve();
      //     }
      //   });
      //   fs.unlink(tempNewLocalFilename, (err) => {
      //     if (err) {
      //       reject(err);
      //     } else {
      //       resolve();
      //     }
      //   });
      // });
    });
}
// [END functions_imagemagick_blur]
