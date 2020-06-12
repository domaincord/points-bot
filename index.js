require('dotenv').config()

const fs = require('fs')
const Discord = require('discord.js')
const client = new Discord.Client()

const prefix = process.env.PREFIX

const POINTS_PER_MESSAGE_SENT = 1
const POINTS_PER_REP_RECEIVED = 100


const admin = require("firebase-admin");
const FieldValue = admin.firestore.FieldValue;
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://domaincord-points.firebaseio.com"
});

const db = admin.firestore();

const hasPositiveThanks = msg => {
  const thankWords = ['thanks', 'thx', 'ty', 'thank you', 'thankyou', 'thank']
  return thankWords.filter(word => msg.content.toLowerCase().includes(word)).length > 0;
}

const incrementUserPointsTotal = (member, points = 1) => {
  const ref = db.collection('users').doc(member.id)
  ref.set({
    totalPoints: FieldValue.increment(points)
  }, {merge: true})
}

const decrementUserPointsTotal = (member, points = 1) => {
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
        let theMember = msg.mentions ? msg.mentions.members.first() : msg.member 
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
            
              const topList = []
              let curr = 1
              snapshot.forEach(doc => {
                topList.push(`${curr}. ${msg.member.guild.members.find(mem => mem.id === doc.id).user.username}: ${doc.data().totalPoints}`)
                curr++
              })
              topTenEmbed.setDescription(topList.join('\n'))
          
              msg.channel.send({embed: topTenEmbed})
            })
            .catch(err => {
              console.log('Error getting documents', err);
            });

      }
  }
  
  if (msg.content.length >= 30) {
       incrementUserPointsTotal(msg.member)
       db.collection('/points').add({
          messageId: msg.id,
          userId: msg.member.id,
          giverId: client.user.id,
          pointValue: POINTS_PER_MESSAGE_SENT,
          timestamp: FieldValue.serverTimestamp()
        }).then(ref => {
          console.log('Added document with ID: ', ref.id);
        })
    
  }
  
  if (hasPositiveThanks(msg)) {
    console.log('thanks logged')
    
    msg.mentions.members.map(member => {
        if (member.id !== msg.member.id) {
           incrementUserPointsTotal(member, 100)
           db.collection('/points').add({
              messageId: msg.id,
              userId: member.id,
              giverId: msg.member.id,
              pointValue: POINTS_PER_REP_RECEIVED,
              timestamp: FieldValue.serverTimestamp()
            }).then(ref => {
              console.log('Added document with ID: ', ref.id);
            }) 
        } else {
          msg.reply(`You can't thank yourself, you silly goose!`)
        }
    })
    
      const mentionsString = msg.mentions.members.array().join(' & ')
      const thankActionVerb = msg.mentions.members.array().length === 1 ? 'has' : 'have'
    
      const thanksEmbed = new Discord.RichEmbed()
        .setTitle('Thanks Received!')
        .setDescription(`${mentionsString} ${thankActionVerb} been thanked by **${msg.member.user.tag}**!`)
        .setFooter(`Use "thanks @user" to give someone rep, and "${prefix}points @user" to see how much they have!`);
      
      return msg.channel.send({embed: thanksEmbed})
  }
})

client.login(process.env.TOKEN)