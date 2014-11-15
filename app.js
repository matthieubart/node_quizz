var config = require('./config'),//Fichier de config config.js
    app = require('express')(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    ent = require('ent'), // Permet de bloquer les caractères HTML (sécurité équivalente à htmlentities en PHP)
    fs = require('fs'), 
    MongoClient = require('mongodb').MongoClient;

const NB_QUESTIONS_BASE = 843;

//Url de la base de données
var url = config.dbUrl;

var pseudos = {};
var scores = {};

var numeroQuestion=1;
var idsQuestions = genererIdsQuestions(1,NB_QUESTIONS_BASE);//fonction définie plus bas

//Connexion MongoDB
MongoClient.connect(url, function(err, db) {
    // Chargement de la page index.html
    app.get('/', function (req, res) {
      res.sendFile(__dirname + '/index.html');
    });

    io.sockets.on('connection', function (socket, pseudo) {
        //Si le client se déconnecte, on efface ses données
        socket.on('disconnect', function () {
            pseudo = pseudos[socket.id];
            delete scores[socket.id+";"+pseudo];
            delete pseudos[socket.id];
            if(Object.keys(pseudos).length==1){
                io.sockets.emit('scores', scores);
            }
            if(Object.keys(pseudos).length==0){
                numeroQuestion=1;
                idsQuestions = genererIdsQuestions(1,NB_QUESTIONS_BASE);
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
                if(reponse==bonneReponse){
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

//Récupérer la question
var findQuestion = function(db, idQuestion ,callback) {
    var collection = db.collection('questions');
    collection.find({'id_questions':idQuestion}).toArray(function(err, resultat) {
        //console.log(err);
        callback(resultat[0]);
    });     
}

//Insérer les ids des questions posées
var insertIdQuestion = function(db, idQuestion ,callback) {
    var collection = db.collection('questions_posees');
    collection.find({'id_questions':idQuestion}).toArray(function(err, resultat) {
        //console.log(err);
        callback(resultat[0]);
    });     
}

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

//Supprimé les caractère spéciaux, les espaces et tous mettre en minuscule
/*function verifierReponse(reponse){

}*/

/*
MongoClient.connect(url, function(err, db) {
    findQuestion(db, 1,function(resultat) {
        console.log(resultat);
        db.close();
    });
});
*/