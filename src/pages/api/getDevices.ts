/*
 * Copyright 2023 Sony Semiconductor Solutions Corp. All rights reserved.
 *
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

import { Client, Config } from 'consoleaccesslibrary'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getConsoleSettings } from '@/config/config'

/**
 * Uses Console to retrieve information about a devices.
 *
 * @returns List about the devices ID.
 */
const getDeviceInfo = async () => {
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
  const response = await client?.deviceManagement?.getDevices()
  if (response.status !== 200) {
    throw new Error(response.response.data)
  }
  return response.data
}

/**
 * Get devices ID List from Console.
 *
 * @param req Request
 * @param res Response
 *
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'The API server only accepts GET requests.' })
    return
  }

  await getDeviceInfo()
    .then((result) => {
      const deviceList: string[] = []
      result.devices.forEach((element: any) => {
        deviceList.push(element.device_id)
      })
      res.status(200).json(deviceList)
    })
    .catch((err) => {
      res.status(500).json({ message: `${err.message}` })
    })
}
