$(document).ready(function(){
    var temps_decompte = 15 ;

    //Socket IO
    var socket = io.connect();

    socket.on("error", function(message){
        alert("Le serveur s'est arrété");
        window.location.reload();
    });

    socket.on('attente', function(){
        $("#attente").html("Attente d'un autre joueur.");
        $("#formulaire_reponse").css("display", "none");
    });

    socket.on('trop_de_joueurs', function() {
        $("html").html("");
        alert("La partie est déjà commencé.");
        window.location.reload();
    });

    socket.on('decompte_debut_partie', function(){
        $("#attente").html("");
        $("#formulaire_reponse").css("display", "none");

        var cpt = 2 ;
        var x ;
        function decompte()
        {
            if(cpt>=0){
                $("#decompte").html("<h1>"+cpt+"</h1>");
                cpt-- ;
                x = setTimeout(decompte,1000) ;
            }
            else{
                clearTimeout(x) ;
                //Les secondes sont passés
                $("#decompte").html("");
                socket.emit("debut_partie");
            }
        }
        decompte();
    });

    socket.on('decompte', function(){
        temps_decompte = 20 ;
        var x ;
        var id_question_envoye = false;
        function decompte()
        {
            if(temps_decompte>=0){
                $("#decompte").html("<h1>"+temps_decompte+"</h1>");
                temps_decompte-- ;
                x = setTimeout(decompte,1000) ;
            }
            else{
                clearTimeout(x) ;
                //Les secondes sont passés
                $("#decompte").html("");
                if(!id_question_envoye){
                    id_question = $("#questions").find("span").text();
                    socket.emit("question_suivante", parseInt(id_question));
                    id_question_envoye=true;
                }
            }
        }
        decompte();

    });

    socket.on('parti_deja_commence', function(){
        $("html").html("");
        window.location.reload();
    });

    socket.on('question', function(question) {
        $("#formulaire_reponse").css("display", "block");
        $("#attente").html("");
        $("#questions").html(question.question);
        console.log(question.reponse);
    });

    socket.on('bonne_reponse', function(pseudo){
        temps_decompte = 15;
        $("#reponsesproposees").html("");
        $("#gagnants").html(pseudo+" a trouvé la bonne réponse. <br />");
    });

    socket.on('mauvaise_reponse', function(reponse){
        $("#reponsesproposees").append(reponse+ " n'est pas la bonne réponse.<br />");
    });

    socket.on('vainqueur', function(vainqueur){
        var message = "";
        if(vainqueur=="egalite"){
            message = "Aucun vainqueur pour cette partie";
        }else{
            message = "Le vainqueur est "+vainqueur;
        }
        $("html").html("");
        alert(message);
        window.location.reload();
    });

    socket.on('scores', function(scores){
        $("#scores").html("");
        $.each(scores, function(pseudo, score) {
            pseudo = pseudo.split(";");
            pseudo = pseudo[1];
            $("#scores").append("<div class='score'>"+pseudo+": <strong>"+score+"</strong></div>");
        });
    });

    //Général
    $("#quizz").css("display","none");
    $("#connexion").css("display","block");

    $('#formulaire_reponse').submit(function () {
        var reponse = $('#reponse').val();
        socket.emit('reponse', reponse); 
        $('#reponse').val('').focus();
        return false;
    });

    $('#formulaire_connexion').submit(function () {
        var pseudo = $('#pseudonyme').val();
        socket.emit('nouveau_client', pseudo);
        $("#quizz").css("display","block");
        $("#connexion").css("display","none");
        return false;
    });

    $(document).on("click", "#rejouer", function(){
        window.location.reload();
    });
});