var express = require('express');
var app = express();
var session = require('express-session');
var conn = require('./dbConfig');
app.set('view engine','ejs');

const fs = require('fs');
const path = require('path');
const MiniSearch = require('minisearch');

let miniSearch = new MiniSearch({
    fields: ['content'],  //what to search
    storeFields: ['title', 'url'] //What to return
});

//Folder containing your static pages/Scan all EJS pages
const viewsDir = path.join(__dirname, 'views');

function indexStaticPages() {
    const files = fs.readdirSync(viewsDir);

    files.forEach(file => {
        if (file.endsWith('.ejs')) {
            const filePath = path.join(viewsDir, file);
            const content = fs.readFileSync(filePath, 'utf8');

            miniSearch.add({
                id: file,
                title: file.replace('.ejs', ''),
                url: '/' + file.replace('.ejs', ''),
                content: content
            });
        }
    });
}

indexStaticPages();

// session setup
app.use(session({
    secret: 'yoursecret',
    resave: true,
    saveUninitialized: true
}));

app.use('/public', express.static('public'));

app.use(express.json());
app.use(express.urlencoded({ extended: true}));

app.get('/',function(req,res){
    res.render("home", {loggedIn: req.session.loggedin});
});

app.get('/login', function(req, res) {
    res.render('login.ejs');
});

app.post('/auth', function(req, res) {
    let email = req.body.username;
    let password = req.body.password;
    if (email && password) {
        conn.query('SELECT * from users where email = ? AND password = ?', [email, password],
            function(error, results, fields) {
                if (error) throw error;
                if (results.length > 0) {
                    req.session.loggedin = true;
                    req.session.username = email;
                    req.session.userid = results[0].id;  //store user ID
                    res.redirect('/discussion');   
                } else {
                    res.send('Incorrect username and/or password!');
                }
                //res.end();
            });
    } else {
        res.send('Please enter Username and Password!');
        res.end();
    }  
});

app.get('/learning', function(req, res) {
    const sql = 'select * from learning';

    conn.query(sql, function(err, results) {
        if (err) throw err;
    
        //Pass results to the EJS page
        res.render('learning', {learning: results, loggedIn: req.session.loggedin});
    });
});

app.get('/bankrates', function(req, res) {
    const sql = 'select interest.*, banks.bankname from interest, banks where interest.bankid = banks.id';

    conn.query(sql, function(err, results) {
        console.log(results)
        if (err) throw err;
    
        //Pass results to the EJS page
        res.render('bankrates', {interest: results, loggedIn: req.session.loggedin});
    });
});

app.post("/", function (req, res, next) {
  var search = req.body.search;
  console.log(search);
  //db.query(`SELECT * FROM incidents WHERE beach="${search}"`, function (err, result) {
  conn.query(
    `SELECT * FROM interest WHERE MATCH description AGAINST ("${search}" WITH QUERY EXPANSION);`,
    function (err, result) {
      if (err) throw err;
      console.log(result);
      res.render("search", { title: "xyz", ResultData: result, loggedIn: req.session.loggedin });
    },
  );
});
//Check search button works
//app.get('/search', (req, res) => {
    //const query = req.query.q;

    //res.send(`You searched for: ${query}`);
//});

//Search
app.get('/search', (req, res) => {
    const query = req.query.q || "";

    // 1. Search static pages
    const staticResults = miniSearch.search(query);

    // 2. Search database
    const sql = `
        SELECT * FROM interest WHERE description LIKE ? OR accounttype LIKE ? OR accountname LIKE ?
        `;

    conn.query(sql, [`%${query}%`, `%${query}%`, `%${query}%`], function(err, dbResults) {
        if (err) throw err;

        // 3. Render both results together
        res.render('searchResults', {
            query,
            staticResults,
            dbResults,
            loggedIn: req.session.loggedin
        });
    }
    );
});

    //res.render('searchResults', { query, results, loggedIn: req.session.loggedin });
//});


//Users can access this if they are logged in
app.get('/learning', function (req, res, next) {
    if (req.session.loggedin) {
        res.render('learning');
    }
   else {
        res.send('Please login to view this page!');
    }
});

//Users can access this only if they are logged in
app.get('/addMPs', function (req, res, next) {
    if (req.session.loggedin) {
        res.render('addMPs');
    }
    else {
        res.send('Please login to view this page!');
    }
});

app.post('/contactus', function(req, res, next) {
    var name = req.body.name;
    var email = req.body.email;
    var content = req.body.content;
    var sql = `insert into contactus (name, email, content) values ("${name}", "${email}", "${content}")`;
    conn.query(sql, function(err, results) {
        if (err) throw err;
        console.log('record inserted');
        res.render('contactus', {contactus: results, loggedIn: req.session.loggedin});
    });
});

    app.post('/discussion', function(req, res, next) {
        var comment = req.body.comment;
        var userid = req.session.userid;
        var date = new Date(); //current date/time

        var sql = `insert into discussionpost (userid, date, comment) values (?, ?, ?)`;

       conn.query(sql, [userid, date, comment], function(err) {
            if (err) throw err;
            console.log('record inserted');
            res.redirect('/discussion');
       });
    });

    app.post('/discussionreply', function(req, res) {
        var comment = req.body.comment;
        var postid = Number(req.body.postid);
        var userid = req.session.userid;
        var date = new Date();
console.log('request', req.body)
        var sql = `Insert into discussionreply (postid, userid, date, comment) values (?, ?, ?, ?)`;

        conn.query(sql, [postid, userid, date, comment], function(err) {
            if (err) throw err;
            console.log('reply added');
            res.redirect('/discussion')

        });
    });


app.post('/register', function(req, res, next) {
    var name = req.body.name;
    var email = req.body.email;
    var password = req.body.password;
    var sql = `INSERT INTO users (name, email, password) VALUES ("${name}", "${email}", "${password}")`;
    conn.query(sql, function(err, result){
        if (err) throw err;
        console.log('record inserted');
        res.render('register');
    });
});


app.get('/listMPs', function (req, res){
    conn.query("select * from mps", function (err, result){
        if (err) throw err;
        console.log(result);
        res.render('listMPs', {title: 'List of NZ MPs', MPsData: result});
    });
});

app.get('/register', function (req, res){
    res.render("register");
});
//app.get('/bankrates', function (req, res){
    //res.render("bankrates",{loggedIn: req.session.loggedin});
//});
app.get('/learning', function (req, res){
    res.render("learning", {loggedIn: req.session.loggedin});
});
app.get('/contactus', function (req, res){
    res.render("contactus", {loggedIn: req.session.loggedin});
});

app.get('/discussion', function (req, res) {
    conn.query("select * from discussionpost order by id desc", function(err, posts) {
        if (err) throw err;

        conn.query("select * from discussionreply order by date asc", function(err, replies) {
            if (err) throw err;

            // Attach replies to each post
            posts.forEach(post => {
                post.replies = replies.filter(r => r.postid === post.id);
            });

            res.render("discussion", {
                discussion: posts,
                loggedIn: req.session.loggedin
            });
        });
    });
});


app.listen(3002);
console.log(' Hey there! Node app is running on port 3002');

app.get('/logout', (req,res) => {
    req.session.destroy();
    res.redirect('/');
});

//app.listen(3003);
//console.log('Node app is running on port 3003');