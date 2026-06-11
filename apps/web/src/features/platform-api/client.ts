import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

export function createDriverClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
  })

  client.interceptors.request.use(config => {
    const token = localStorage.getItem('driver-token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  return client
}
