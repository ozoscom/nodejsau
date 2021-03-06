const githubUrl  = 'https://api.github.com/repos/polyhack/nodejsau/issues?state=open'
    , hyperquest = require('hyperquest')
    , bl         = require('bl')
    , brucedown  = require('brucedown')
    , map        = require('map-async')
    , ttl        = 1000 * 60 // 1 min
    , authorised = require('../authorised_users')

var data

function loadPosts (callback) {
  if (data && data.timestamp >= Date.now() - ttl)
    return process.nextTick(callback.bind(null, null, data.posts))

  var url = githubUrl
  if (process.env.GHTOKEN)
    url += '&access_token=' + process.env.GHTOKEN

  hyperquest(url).pipe(bl(function (err, _body) {
    if (err) {
      console.error(err)
      if (data)
        return callback(null, data) // stale data is better than no data!
      return callback(err)
    }

    var body, posts

    try {
      body = JSON.parse(_body.toString())
    } catch (e) {
      return callback(e)
    }
    if (body.message)
      return callback(new Error(body.message))
    if (!Array.isArray(body))
      return callback(new Error('unexpected response from GitHub'))

    posts = body.filter(function (issue) {
      return (
           issue.user
        && authorised.indexOf(issue.user.login) > -1
        && issue.title
        && (/^post:/i).test(issue.title)
        && issue.body
      )
    }).map(function (issue) {
      return {
          url      : issue.html_url
        , number   : issue.number
        , comments : issue.comments || 0
        , title    : issue.title.replace(/^post:\s*/i, '')
        , user     : { login: issue.user.login, avatar: issue.user.avatar_url }
        , date     : new Date(issue.created_at)
        , body     : issue.body
      }
    })

    map(
        posts
      , function iterator (post, i, callback) {
          brucedown(post.body, function (err, html) {
            if (err)
              return callback(err)
            post.body = html
            callback(null, post)
          })
        }
      , function (err, posts) {
          if (err)
            return callback(err)
          data = {
              timestamp : Date.now()
            , posts     : posts
          }
          callback(null, posts)
        }
    )
  }))

}

/*
loadPosts(function (err, posts) {
  console.log(err, JSON.stringify(posts))
})
*/

module.exports = loadPosts