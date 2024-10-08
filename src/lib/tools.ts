import type { CoreMessage } from 'ai'
import { Context, InlineKeyboard } from 'grammy'

import { generateEmbeddings } from './ai/embeddings'
import { db as database } from './db'
import { embeddings as embeddingsTable } from './db/schema/embeddings'
import {
  insertResourceSchema,
  type NewResourceParameters,
  resources,
} from './db/schema/resources'

export const createResource = async (
  input: NewResourceParameters,
): Promise<string> => {
  try {
    const { content } = insertResourceSchema.parse(input)

    const [resource] = await database
      .insert(resources)
      .values({ content })
      .returning()

    if (!resource) {
      return 'Resource not found'
    }

    const embeddings = await generateEmbeddings(content)
    await database.insert(embeddingsTable).values(
      embeddings.map((embedding) => ({
        resourceId: resource.id,
        ...embedding,
      })),
    )

    return 'Resource successfully created and embedded.'
  } catch (error) {
    return error instanceof Error && error.message.length > 0
      ? error.message
      : 'Error, please try again.'
  }
}

export const createConfirmAppointment = (availableTimeSlots: string[]) => {
  return async ({ slot }: { slot: string }): Promise<string> => {
    console.log(
      `Called createConfirmAppointment tool with ${JSON.stringify({ slot }, null, 2)}`,
    )

    const slotIndex = availableTimeSlots.indexOf(slot)
    if (slotIndex === -1) {
      return 'Sorry, that time slot is no longer available. Please choose another one.'
    }

    availableTimeSlots.splice(slotIndex, 1)

    return `Your appointment at ${slot} is confirmed!`
  }
}

export const createDisplaySelectionButtons = (
  context: Context,
  conversations: Map<number, CoreMessage[]>,
) => {
  return async ({
    options,
    question,
  }: {
    options: string[]
    question: string
  }): Promise<null> => {
    console.log(
      `Called createDisplaySelectionButtons tool with ${JSON.stringify({ options, question }, null, 2)}`,
    )

    const buttonsRows = []
    for (let index = 0; index < options.length; index += 2) {
      buttonsRows.push(
        options
          .slice(index, index + 2)
          .map((option: string) => ({ data: `slot-${option}`, label: option }))
          .map(({ data, label }) => InlineKeyboard.text(label, data)),
      )
    }

    await context.reply(question, {
      reply_markup: InlineKeyboard.from(buttonsRows),
    })

    const content = `${question}: ${options.join(', ')}`

    const chatId = context?.chat?.id as number
    const messages = conversations.get(chatId) ?? []
    messages.push({ content, role: 'assistant' })
    conversations.set(chatId, messages)

    return null
  }
}

export const createFindAvailableSlots = (availableTimeSlots: string[]) => {
  return async (): Promise<string[]> => {
    console.log(`Called createFindAvailableSlots tool`)
    return availableTimeSlots
  }
}
