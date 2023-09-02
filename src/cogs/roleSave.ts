import {client, prisma} from '../index';
import {GuildMember} from 'discord.js';
import {PrismaClientKnownRequestError} from '@prisma/client/runtime/library';


client.on('guildMemberAdd', async (member) => {
  const member_id = BigInt(member.id)
  await createUser(member_id)
  const roles = await prisma.role.findMany({
    where: {
      author_id: member_id
    }
  })
  console.log(`${member.displayName}: [${roles.join(", ")}]`)
  /*
  await member.edit({
    roles: roles.map((r) => String(r.id))
  })
   */
})

client.on('guildMemberUpdate', async (_, newMember) => {
  await updateMemberRole(newMember)
})

client.on('guildMemberRemove', async (member) => {
  if (!(member instanceof GuildMember)) {
    return
  }
  await updateMemberRole(member)
})

const createUser = async (member_id: bigint) => {
  try {
    await prisma.user.create({
      data: {
        id: member_id
      },
    })
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code !== 'P2002') {
      return false
    }
    throw e
  }
  return true
}

const updateMemberRole = async (member: GuildMember) => {
  const member_id = BigInt(member.id)
  await createUser(member_id)
  const roles = member.roles.cache.clone()
  const data = roles.map((r) => {
    return {
      id: BigInt(r.id),
      author_id: member_id
    }
  })
  await prisma.role.createMany({
    data: data,
    skipDuplicates: true,
  })
  await prisma.role.deleteMany({
    where: {
      author_id: member_id,
      id: {notIn: roles.map((r) => BigInt(r.id))}
    }
  })
}