// import { getLogger } from '@/logger'

export const getRandomNumber = (min = 0, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min
export const toBinary = (number) => {
  if (typeof number !== 'number' || isNaN(number)) {
    throw new Error('Invalid input: must be a number')
  }
  return number.toString(2)
}
export const getRandomBinary = (min = 0, max = 100) => {
  // const validationLogger = getLogger(getRandomBinary.name, { file: __filename })
  validationLogger.info('Validation started')
  const num = getRandomNumber(min, max)
  const binary = toBinary(num)
  validationLogger.info({ num, binary }, 'Validation ended with result')
  return { num, binary }
}
