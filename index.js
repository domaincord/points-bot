require('dotenv').config()

const fs = require('fs')
const Discord = require('discord.js')
const client = new Discord.Client()

const prefix = process.env.PREFIX

const MIN_POINTS_PER_MESSAGE_SENT = 1
const MAX_POINTS_PER_MESSAGE_SENT = 10
const POINTS_PER_REP_RECEIVED = 100

const admin = require("firebase-admin");
const FieldValue = admin.firestore.FieldValue;
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://domaincord-market.firebaseio.com"
});

const db = admin.firestore();

const hasPositiveThanks = msg => {
  const thankPattern = /[^a-z](thanks?|thx|ty|thankyou)[^a-z]/g
  const messageWords = msg.content.toLowerCase().split(' ')
  if ( msg.content.toLowerCase().match(thankPattern) ) {
    return true
  } else if ( /(thanks?|thx|ty|thankyou)[^a-z]+/.test(messageWords[0]) ) {
    return true
  } else if ( /[^a-z]+(thanks?|thx|ty|thankyou)/.test( messageWords[messageWords.length - 1] ) ) {
    return true
  } else if ( /(thanks?|thx|ty|thankyou)/.test( messageWords[0] ) ) {
    return true
  } else if ( /(thanks?|thx|ty|thankyou)/.test( messageWords[messageWords.length - 1] ) ) {
    return true
  } else {
    return false
  }
}

const incrementUserPointsTotal = (member, points = MIN_POINTS_PER_MESSAGE_SENT ) => {
  const ref = db.collection('users').doc(member.id)
  ref.set({
    totalPoints: FieldValue.increment(points)
  }, {merge: true})
}

const decrementUserPointsTotal = (member, points = MIN_POINTS_PER_MESSAGE_SENT ) => {
  const ref = db.collection('users').doc(member.id)
  ref.set({
    totalPoints: FieldValue.decrement(points)
  }, {merge: true})
}

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`)
  await client.user.setActivity('Tracking member points!');
})

client.on('message', msg => {
  if (msg.author.bot) return
  
  if (msg.content.indexOf(prefix) === 0) {
     const args = msg.content
        .slice(prefix.length)
        .trim()
        .split(/ +/g)

      const command = args
        .shift()
        .toLowerCase()
        .replace('/', '')

      if (command === 'points') {
        let theMember = msg.mentions.members.array().length > 0 ? msg.mentions.members.first() : msg.member 
        let memberRef = db.collection('users').doc(theMember.id);
        let getDoc = memberRef.get()
          .then(doc => {
            if (!doc.exists) {
              console.log('No such member document!');
            } else {
              console.log('Document data:', doc.data().totalPoints);
              const memberPointsEmbed = new Discord.RichEmbed()
                .setTitle(`${theMember.user.username}'s Points`)
                .setDescription(`Total Points: ${doc.data().totalPoints}`)
                .setFooter(`Use "thanks @user" to give someone rep, and "${prefix}points @user" to see how much they have!`);
              
              msg.channel.send({embed: memberPointsEmbed})
            }
          })
          .catch(err => {
            console.log('Error getting document', err);
          });

      }
    
      if (command === 'top') {
        
        db.collection('users').orderBy('totalPoints', 'desc').limit(10).get()
            .then(snapshot => {
              if (snapshot.empty) {
                console.log('No matching documents.');
                return;
              }  

              const topTenEmbed = new Discord.RichEmbed()
                .setTitle('Most Reputation');
          
              const lines = []
              const members = msg.guild.members.filter(member => !member.user.bot)
              
              let curr = 1
              snapshot.forEach(doc => {
                const member = members.find(member => member.id === doc.id)
                if (member) {
                  let line = `${curr}. ${member.user.tag}: ${doc.data().totalPoints}`
                  curr++
                  lines.push(line)
                }
              })
          
              console.log(lines)
              topTenEmbed.setDescription(lines.join('\n'))

              msg.channel.send({embed: topTenEmbed}) 
              
            })
            .catch(err => {
              console.log('Error getting documents', err);
            });

      }
  }
  
  if (msg.content.length >= 30) {
       incrementUserPointsTotal(msg.member, MAX_POINTS_PER_MESSAGE_SENT)
       db.collection('/points').add({
          messageId: msg.id,
          userId: msg.member.id,
          giverId: client.user.id,
          pointValue: MAX_POINTS_PER_MESSAGE_SENT,
          timestamp: FieldValue.serverTimestamp()
        }).then(ref => {
          console.log('Added document with ID: ', ref.id);
        })
  } else {
      incrementUserPointsTotal(msg.member)
       db.collection('/points').add({
          messageId: msg.id,
          userId: msg.member.id,
          giverId: client.user.id,
          pointValue: MIN_POINTS_PER_MESSAGE_SENT,
          timestamp: FieldValue.serverTimestamp()
        }).then(ref => {
          console.log('Added document with ID: ', ref.id);
        })
  }
  
  if (hasPositiveThanks(msg)) {
    console.log('thanks logged')
    if (msg.mentions.members.array().length >= 1) {
      msg.mentions.members.map(member => {
          if (!member.bot) {
            return msg.reply('You cannot thank a bot.')
          }
          if (member.id !== msg.member.id) {
             incrementUserPointsTotal(member, POINTS_PER_REP_RECEIVED)
             db.collection('/points').add({
                messageId: msg.id,
                userId: member.id,
                giverId: msg.member.id,
                pointValue: POINTS_PER_REP_RECEIVED,
                timestamp: FieldValue.serverTimestamp()
              }).then(ref => {
                  console.log('Added document with ID: ', ref.id);
                  const mentionsString = msg.mentions.members.array().join(' & ')
                  const thankActionVerb = msg.mentions.members.array().length === 1 ? 'has' : 'have'

                  const thanksEmbed = new Discord.RichEmbed()
                    .setTitle('Thanks Received!')
                    .setDescription(`${mentionsString} ${thankActionVerb} been thanked by **${msg.member.user.tag}**!`)
                    .setFooter(`Use "thanks @user" to give someone rep, and "${prefix}points @user" to see how much they have!`);

                  msg.channel.send({embed: thanksEmbed})
              }) 
          } else {
            msg.reply(`You can't thank yourself, you silly goose!`)
          }
      })
    } else {
      msg.reply('You must tag someone to thank them.')
    }
  }
})

client.login(process.env.TOKEN)