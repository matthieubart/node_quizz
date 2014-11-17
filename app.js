var config = require('./config'),//Fichier de config config.js
twig = require("twig"),
express = require('express'),
app = require('express')(),
server = require('http').createServer(app),
io = require('socket.io').listen(server),
    ent = require('ent'), // Permet de bloquer les caractères HTML (sécurité équivalente à htmlentities en PHP)
    fs = require('fs'), 
    MongoClient = require('mongodb').MongoClient;

//Fichier en front : dans le repertoire public, puis css ou js
app.use(express.static(__dirname + '/public'));

const NB_QUESTIONS_BASE = 843;

//Url de la base de données
var url = config.dbUrl;

var pseudos = {};
var scores = {};

var numeroQuestion=1;
var idsQuestions = genererIdsQuestions(1,NB_QUESTIONS_BASE);//fonction définie plus bas

var rejoindreLeJeu = true;

/////////
//ROUTES 

//Jeu : Matthieu
app.get('/', function (req, res) {
    res.render("jeu.twig");
});

//Résultats : Romain
app.get('/resultats/scores', function(req, res){
    MongoClient.connect(url, function(err, db) {
        findScores(db, function(scores) {
            var results = [];
            var index = 0;
            for (var i = 0; i < scores.length; i++) {
                var alreadyExist = -1;
                for(var j = 0; j < results.length; j++){
                    if(results[j][0] == scores[i]["pseudo"]){
                        alreadyExist = j;
                        break;
                    }
                }
                if(alreadyExist == -1){
                    alreadyExist = index;
                    //pseudo
                    results[alreadyExist] = [];
                    results[alreadyExist][0] = scores[i]['pseudo'];
                    results[alreadyExist][1] = 0;
                    results[alreadyExist][2] = 0;
                    results[alreadyExist][3] = 0;
                    index++;
                } else{
                    results[alreadyExist][1]  += scores[i]["score"] ;
                    if(scores[i]["partie_finie"]){
                        results[alreadyExist][2]++;
                    }
                    results[alreadyExist][3]++;
                }
            };
            res.render("resultats_scores.twig", {donnees:results});
            db.close();
        });
});
});



app.get('/resultats/questions', function(req, res){
    MongoClient.connect(url, function(err, db) {
        findIdsQuestions(db, function(questions_ids) {
            findIntulesQuestions(db, questions_ids, function(questions_posees){
                res.render("resultats_questions.twig", {questions_posees:questions_posees});
                db.close();
            });
        });
    });
});

//////
//JEU

//Connexion MongoDB
MongoClient.connect(url, function(err, db) {
    io.sockets.on('connection', function (socket, pseudo) {
        //Si le client se déconnecte, on efface ses données
        socket.on('disconnect', function () {
            pseudo = pseudos[socket.id];
            //Enregistrement du score : pseudo, score, partie finie ou non
            if(pseudo != undefined){
                if(numeroQuestion==11){
                    insertScoreJoueur(db, pseudo, scores[socket.id+";"+pseudo], true);
                }else{
                    insertScoreJoueur(db, pseudo, scores[socket.id+";"+pseudo], false);
                }
            }
            delete scores[socket.id+";"+pseudo];
            delete pseudos[socket.id];
            if(Object.keys(pseudos).length==1){
                io.sockets.emit('scores', scores);
            }
            if(Object.keys(pseudos).length==0){
                numeroQuestion=1;
                idsQuestions = genererIdsQuestions(1,NB_QUESTIONS_BASE);
                rejoindreLeJeu = true;
                //insertIdQuestion(db, idsQuestions);
            }
        });

        socket.on('nouveau_client', function(pseudo) {
            pseudo = ent.encode(pseudo);
            pseudos[socket.id] = pseudo;
            scores[socket.id+";"+pseudo] = 0;

            io.sockets.emit('scores', scores);

            if(Object.keys(pseudos).length==2 && numeroQuestion==1){//Object.keys(quesArr).length : taille tableau associatif
                io.sockets.emit('decompte_debut_partie');
            }else if(Object.keys(pseudos).length>2){
                socket.emit('parti_deja_commence');
                delete scores[socket.id+";"+pseudo];
                delete pseudos[socket.id];
                io.sockets.emit('scores', scores);
            }else{
                socket.emit('attente');
            }
        });

        socket.on('debut_partie', function(){
            //Pour la première partie, insertion des ids des questions
            if(rejoindreLeJeu){
                insertIdQuestion(db, idsQuestions);
                rejoindreLeJeu=false;
            }
            socket.emit("decompte");
            //Cherche la question dans la base de données
            findQuestion(db, idsQuestions[numeroQuestion], function(resultat) {//requete pour la question
                io.sockets.emit('question', "Question : <span>"+numeroQuestion+"</span>/10 : "+resultat.intitule+" ? "+resultat.reponse+"."+resultat.id_questions);//cacher la réponse une fois fini et l'id
            });
        });

        socket.on('question_suivante', function(id_question){
            io.sockets.emit('scores', scores);
            //Tester nombre de question pour savoir si la partie est finie
            numeroQuestion=id_question+1;
            if(numeroQuestion<11){
                socket.emit("decompte");
                findQuestion(db, idsQuestions[numeroQuestion],function(resultat) {//requete pour la question
                    io.sockets.emit('question', "Question : <span>"+numeroQuestion+"</span>/10 : "+resultat.intitule+" ? "+resultat.reponse+"."+resultat.id_questions);//cacher la réponse une fois fini et l'id
                });
            //Afficher le gagnant
        }else{
                var vainqueur = chercherVainqueur(scores);//fonction chercherVainqueur définie plus bas
                io.sockets.emit('vainqueur', vainqueur);
            }
        });

        socket.on('reponse', function (reponse) {
            pseudo = pseudos[socket.id];
            findQuestion(db, idsQuestions[numeroQuestion], function(resultat) {//requete pour le résultat
                if(reponse.isNumber()){
                    bonneReponse = resultat.reponse;
                }else{//On n'applique pas la fonction encode
                reponse = ent.encode(reponse).trim();
                bonneReponse = ent.encode(resultat.reponse).trim();
            }
            if(reponse==bonneReponse && reponse != ""){
                    //secondsToReset=10;
                    io.sockets.emit('bonne_reponse', pseudo);
                    scores[socket.id+";"+pseudo]+=5;
                    io.sockets.emit('scores', scores);
                    numeroQuestion++;
                    //Tester nombre de question pour savoir si la partie est finie
                    if(numeroQuestion<11){
                        findQuestion(db, idsQuestions[numeroQuestion],function(resultat) {//requete pour la question
                            io.sockets.emit('question', "Question : <span>"+numeroQuestion+"</span>/10 : "+resultat.intitule+" ? "+resultat.reponse+"."+resultat.id_questions);//cacher la réponse une fois fini et l'id
                        });
                    //Afficher le gagnant
                }else{
                        var vainqueur = chercherVainqueur(scores);//fonction chercherVainqueur définie plus bas
                        io.sockets.emit('vainqueur', vainqueur);
                    }
                }else{
                    scores[socket.id+";"+pseudo]--;
                    io.sockets.emit('scores', scores);
                    socket.emit('mauvaise_reponse', reponse);
                }
            });
}); 
});

});

server.listen(8080);

//////////////////////
//Fonctions 

/////
//MongoDB

//Récupérer les scores :
var findScores = function(db, callback) {
    var collection = db.collection('scores_joueurs');
    collection.find({}, {'_id':0}).toArray(function(err, scores) {
        callback(scores);
    });     
}

//Récupérer les ids des questions posées :
var findIdsQuestions = function(db, callback) {
    var collection = db.collection('questions_posees');
    collection.find({}, {'_id':0}).toArray(function(err, questions_posees) {//N'afficher que les id_questions
        callback(questions_posees);
    });     
}

//Récupérer les intitulés des questions posées
var findIntulesQuestions = function(db, questions_ids, callback){
    var questions = new Array();
    var cpt = 0;
    for(var cle in questions_ids){
        questions[cpt] = questions_ids[cle]['id_questions_posees'];
        cpt++;
    }
    var collection = db.collection('questions');
    collection.find({ 'id_questions' : { $in : questions }}, {'_id':0, 'reponse':0}).toArray(function(err, questions_posees) {//N'afficher que les id_questions
        callback(questions_posees);
    });
}

//Récupérer la question
var findQuestion = function(db, idQuestion ,callback) {
    var collection = db.collection('questions');
    collection.find({'id_questions':idQuestion}).toArray(function(err, resultat) {
        //console.log(err);
        callback(resultat[0]);
    });     
}

//Insérer les ids des questions posées
var insertIdQuestion = function(db, idsQuestions) {
    var collection = db.collection('questions_posees');
    var question;
    for(i=1;i<11;i++){
        question = {id_questions_posees:idsQuestions[i]};
        collection.insert(question, function(err, records) {
            console.log("Enregistré "+records[0]._id);
        }); 
    } 
}

//Inséré les scores
var insertScoreJoueur = function(db, pseudo, score, partieFinie){
    var collection = db.collection('scores_joueurs');
    console.log(score);
    console.log(pseudo);
    if(partieFinie){
        scoreAInserer = {pseudo:pseudo,score:score, partie_finie:true};
    }else{
        scoreAInserer = {pseudo:pseudo,score:score, partie_finie:false};
    }
    collection.insert(scoreAInserer, function(err, records) {
        console.log("Enregistré "+records[0]._id);
    }); 
} 


/////
//Général

//Généré un tableau de nombres aléatoires entre min et max 
function genererIdsQuestions(min, max) {
    var ids = {};
    for(i=1;i<11;i++){
        ids[i] = Math.floor(Math.random() * (max - min + 1) + min);
    }
    return ids;
}

//Une string contient que des nombres
String.prototype.isNumber = function(){return /^\d+$/.test(this);}

//Connaitre le vainqueur
function chercherVainqueur(scores){
    var tableauScores = new Array();
    var tableauPseudos = new Array();
    var vainqueurId = "";
    for(var joueur in scores){
        tableauScores.push(scores[joueur]);       
        tableauPseudos.push(joueur);       
    }
    //Vainqueur : Joueur 1
    if(tableauScores[0] > tableauScores[1]){
        vainqueurId = tableauPseudos[0];
        vainqueurId = vainqueurId.split(";");
        vainqueurId = vainqueurId[1];
    //Egalité
}else if(tableauScores[0]==tableauScores[1]){
    vainqueurId = "egalite";
    //Si il n'y a qu'un joueur
}else if(tableauScores.length==1){
    vainqueurId = tableauPseudos[0];
    vainqueurId = vainqueurId.split(";");
    vainqueurId = vainqueurId[1];
    //Vainqueur : Joueur 2
}else{
    vainqueurId = tableauPseudos[1];
    vainqueurId = vainqueurId.split(";");
    vainqueurId = vainqueurId[1];
}
return vainqueurId;
}