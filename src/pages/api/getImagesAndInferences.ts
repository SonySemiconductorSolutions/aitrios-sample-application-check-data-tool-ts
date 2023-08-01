/*
 * Copyright 2023 Sony Semiconductor Solutions Corp. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Client, Config } from 'consoleaccesslibrary'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getConsoleSettings } from '@/config/config'
import deserializeObjectDetection from '@/utils/ObjectDetection/deserialize'

/**
 * Use Console to get sub directories of deviceId.
 *
 * @param deviceId The id of the device to get uploaded image data.
 * @param outputSubDir The name of image directory to get uploaded image data.
 * @param numberOfImages The number of images to get.
 *
 * @returns List of objects with combined images, inference results (deserialized) and timestamps.
 *          EX. [{image: "base64image string", inferenceData: "inference result data", timestamp: '20230126052344873'}]
 */
const getImageAndInference = async (deviceId: string, outputSubDir: string, numberOfImages: number) => {
  const consoleSettings = getConsoleSettings()
  let client
  try {
    const config = new Config(
      consoleSettings.console_access_settings.console_endpoint,
      consoleSettings.console_access_settings.portal_authorization_endpoint,
      consoleSettings.console_access_settings.client_id,
      consoleSettings.console_access_settings.client_secret,
    )
    client = await Client.createInstance(config)
  } catch (err) {
    throw new Error('Wrong setting. Check the settings.')
  }

  const skip = 0
  const orderBy = 'DESC'
  const imageData = await client.insight?.getImages(deviceId, outputSubDir, numberOfImages, skip, orderBy)

  const outputList: Array<{
    image: string
    inferenceData: string
    timestamp: string
  }> = []
  for (let i = 0; i < imageData.data.images.length; i += 1) {
    const inputTensor = imageData.data.images[i]
    console.log('GetImages response: ', JSON.stringify(inputTensor.name))

    const timestamp = inputTensor.name.replace('.jpg', '')
    const base64Img = `data:image/jpg;base64,${inputTensor.contents}`
    const NumberOfInferenceresults = 1
    const filter = undefined
    const raw = 1

    // eslint-disable-next-line no-await-in-loop
    const resInference = await client?.insight.getInferenceResults(
      deviceId,
      filter,
      NumberOfInferenceresults,
      raw,
      timestamp,
    )
    if (resInference.status !== 200) {
      throw new Error(resInference.response.data)
    }
    if (resInference.data.length === 0 || !resInference.data[0].inferences[0].O) {
      throw new Error('Cannot get inference results.')
    }

    try {
      const decodedData = Buffer.from(resInference.data[0].inferences[0].O, 'base64')
      const deserializedData = deserializeObjectDetection(decodedData)
      const inferenceData = JSON.stringify(deserializedData)
      const output = { image: base64Img, inferenceData, timestamp }
      outputList.push(output)
    } catch (err: any) {
      throw new Error(err.message)
    }
  }
  return outputList
}

/**
 * Get images and inference results from Console.
 *
 * @param req Request
 * deviceId: Edge AI device ID.
 * outputSubDir: Subdirectory where inference results are stored.
 * numberOfImages: The number of images to get.
 *
 * @param res Response
 *
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'The API server only accepts GET requests.' })
    return
  }

  if (!req.query.deviceId) {
    res.status(400).json({ message: 'Device ID is not specified.' })
    return
  }
  const deviceId = req.query.deviceId ? req.query.deviceId.toString() : ''
  const outputSubDir = req.query.imagePath ? req.query.imagePath.toString() : ''
  const numberOfImages = req.query.numberOfImages ? parseInt(req.query.numberOfImages.toString(), 10) : 5

  await getImageAndInference(deviceId, outputSubDir, numberOfImages)
    .then((result) => {
      res.status(200).json(result)
    })
    .catch((err) => {
      if (err.response) {
        res.status(500).json({ message: err.response.data.message })
      } else {
        res.status(500).json({ message: `${err.message}` })
      }
    })
}
