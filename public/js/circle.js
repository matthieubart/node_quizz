function dessiner(donnees){
  var diameter = 760;  

  var svg = d3.select("#contenu").append("svg")
  .attr("width", diameter)
  .attr("height", diameter)
  .attr("id", "svg")
  .attr("class", "YlOrRd");

  var bubble = d3.layout.pack()
  .sort(null)
  .size([diameter, diameter])
  .padding(1.5)
  .value(function(d) { 
    return +d[3]; 
  });

  var quantile = d3.scale
  .quantile()
  .domain([0, d3.max(donnees, function(e) { 
    return +e[3]; 
  })
  ])
  .range(d3.range(9));

  var node = svg.selectAll(".node")
  .data(bubble.nodes({children: donnees})
    .filter(function(d) { return !d.children; }))
  .enter().append("g")
  .attr("class", "node")
  .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

  node.append("circle")
  .attr("r", function(d) { return d.r; })
  .attr("class", function(d) {
    var max = d3.max(donnees, function(e) { 
      return +e[3]; 
    });
    var inRangeValue = d3.round(d[3]*8/max);
    return "joueur q" + inRangeValue + "-9"; });

  node.append("text")
  .attr("dy", ".3em")
  .style("text-anchor", "middle")
  .attr("class", "text")
  .text(function(d) { return d[0].substring(0, d.r / 3); });

  node.append("title")
  .text(function(d) { 
    var scoreMoyen = d[1] / d[3];
    var abandon = d[3] - d[2];
    var ratio = abandon/d[3] * 100;
    return " Joueur : " + d[0] 
    + "\n Score total: " + d[1] 
    + "\n Score moyen par partie jouée : " + scoreMoyen 
    + "\n Nombre de partie commencée :   " + d[3]
    + "\n Nombre de partie abandonée :   "+ abandon
    + "\n Nombre de partie terminée :    " + d[2]
    + "\n Pourcentage d'abandon :        " + ratio;
  });
}