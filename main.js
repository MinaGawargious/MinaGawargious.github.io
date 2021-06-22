let svgns = "http://www.w3.org/2000/svg";
let svg = document.querySelector("svg");

function setAttributes(element, attributes){
    for (let key in attributes){
        element.setAttribute(key, attributes[key]);
    }
}

let numNodes = 0;
let sourceNode = newLine = newWeightText = draggedItem = null;
let selectedRect = document.createElementNS(svgns, "rect");
setAttributes(selectedRect, {"fill": "none", "stroke": "blue"});
let selected = null;
let weighted = true, directed = true;

let adjacencyList = {}; // startID: [endIds]
let lines = {}; // startID: [lineObject, label]
let func = DFS;
let code = document.getElementById("DFSCode");
let startNode = null;

let steps = []; // {elements: [], actions: [], classList: []}
let discovered = [];

let algorithms = document.querySelectorAll(".algorithm");
for(let algorithm of algorithms){
    algorithm.addEventListener("click", () => {
        func = window[algorithm.classList[0]];
        code = document.getElementById(func.name+"Code");
        setWeighted(algorithm.getAttribute("weighted") == "true");
        setDirected(algorithm.getAttribute("directed") == "true");
        console.log(algorithm);
    });
}

let h = 6;
let w = 4;
let defs = document.createElementNS(svgns, "defs");

for (color of ["Black", "Blue"]){
    for (distance of ["Near", "Far"]){
        let arrowheadMarker = document.createElementNS(svgns, "marker");
        setAttributes(arrowheadMarker, {"id": `arrowhead${color}_${distance}`, "markerWidth": h, "markerHeight": w, "refX": distance == "Far" ? 0 : h, "refY": w/2, "orient": "auto", "fill": color});
        let arrowhead = document.createElementNS(svgns, "polygon");
        arrowhead.setAttribute("points", `0 0, ${h} ${w/2}, 0 ${w}`);
        arrowheadMarker.appendChild(arrowhead);
        defs.appendChild(arrowheadMarker); 
    }
}
svg.appendChild(defs);

let started = false;
let stepSlider = document.getElementById("stepSlider");

playPause = document.getElementsByClassName("playPause")[0];
playPause.onclick = async (event) => { // async is syntactic sugar to return the values as a resolved promise.
    event.preventDefault();
    if(playPause.classList.contains("play")) { // Currently paused. Now play.
        playPause.classList.remove("play");
        if(!started){
            started = true;
            await func(startNode); // await pauses execution until the promise is resolved.
            execute();
        }
        console.log("setting max to ", steps.length);
        stepSlider.setAttribute("max", steps.length);
        stepSlider.classList.remove("disableSelect", "disableElement");
    } else{ // Currently playing. Now pause.
        playPause.classList.add("play");
    }
};

function isNumber(evt) {
    var charCode = evt.keyCode;
    return ( (charCode <= 31) || (charCode >= 48 && charCode <= 57) );
}

form = document.getElementsByTagName("form")[0];
start = form.getElementsByTagName("input")[0];
form.onpaste = event => event.preventDefault();
form.onsubmit = (event) => {
    event.preventDefault();
    if(start.value < numNodes){
        startNode.classList.remove("startNode");
        let newStart = document.getElementById(parseInt(start.value));
        newStart.classList.add("startNode");
        startNode = newStart;
    }
}

// Returns stroke, arrowhead, and end coordinates.
function getLineProperties(x1, y1, x2, y2){
    let distance = Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));
    if(distance > 4*h){
        let theta = Math.atan((x2-x1)/(y1-y2));
        let dx = (y2 > y1) ? -4*h*Math.sin(theta) : 4*h*Math.sin(theta); // The 4 is from the stroke width.
        let dy = (y2 > y1) ? -4*h*Math.cos(theta) : 4*h*Math.cos(theta);
        return [x2-dx, y2+dy, "black", "arrowheadBlack_Far"];
    }
    return [x2, y2, "transparent", "arrowheadBlack_Near"];
}

function updateLabelPosition(x1, y1, x2, y2, label){
    let theta = Math.atan((x2-x1)/(y1-y2));
    let dy = (y2 > y1) ? -Math.sin(theta) : Math.sin(theta);
    let dx = (y2 > y1) ? -Math.cos(theta) : Math.cos(theta);
    let padding = 0.1;
    let labelWidth = label.getBBox().width, labelHeight = label.getBBox().height;
    let labelCenter = {"x": (x2+x1)/2 - dx*labelWidth*(0.5+padding), "y": (y2+y1)/2 - dy*labelHeight*(0.5 + padding)};
    setAttributes(label, {"x": labelCenter.x, "y": labelCenter.y, "text-anchor": "middle", "dominant-baseline": "middle"});
}

// Used to shift when we create a double connection and when we drag. (x1, y1) is source point, (x2, y2) is end point.
function updateDoubleConnection(incoming, outgoing, incomingLabel, outgoingLabel, x1, y1, x2, y2, id1, id2){
    let theta = Math.atan((x2-x1)/(y1-y2));
    let dx = (y2 > y1) ? -Math.cos(theta) : Math.cos(theta);
    let dy = (y2 > y1) ? -Math.sin(theta) : Math.sin(theta);
    if(directed){
        let [incomingX2, incomingY2, incomingArrowheadColor, incomingArrowhead] = getLineProperties(x1, y1, x2, y2);
        let [outgoingX2, outgoingY2, outgoingArrowheadColor, outgoingArrowhead] = getLineProperties(x2, y2, x1, y1);

        setAttributes(incoming, {"x1": x1 - w*dx, "y1": y1 - w*dy, "x2": incomingX2 - w*dx, "y2": incomingY2 - w*dy, "stroke": incomingArrowheadColor, "marker-end": `url(#${incomingArrowhead})`});
        setAttributes(outgoing, {"x1": x2 + w*dx, "y1": y2 + w*dy, "x2": outgoingX2 + w*dx, "y2": outgoingY2 + w*dy, "stroke": outgoingArrowheadColor, "marker-end": `url(#${outgoingArrowhead})`});

        setAttributes(incomingLabel, {"pointer-events": weighted ? "auto" : "none", "opacity": weighted ? 1 : 0});
        setAttributes(outgoingLabel, {"pointer-events": weighted ? "auto" : "none", "opacity": weighted ? 1 : 0});
    }else{
        setAttributes(incoming, {"x1": x1, "y1": y1, "x2": x2, "y2": y2, "stroke": "black"});
        setAttributes(outgoing, {"x1": x2, "y1": y2, "x2": x1, "y2": y1, "stroke": "black"});
        incoming.removeAttribute("marker-end");
        outgoing.removeAttribute("marker-end");
        let labelToRemove = id1 < id2 ? incomingLabel : outgoingLabel;
        setAttributes(labelToRemove, {"pointer-events": "none", "opacity": 0});
    }

    updateLabelPosition(x1 - w*dx, y1 - w*dy, x2 - w*dx, y2 - w*dy, incomingLabel);
    updateLabelPosition(x2 + w*dx, y2 + w*dy, x1 + w*dx, y1 + w*dy, outgoingLabel);
}

function updateSingleConnection(line, label, x1, y1, x2, y2){
    if(x1 != x2 || y1 != y2){ // Avoid 0/0.
        let [lineX2, lineY2, lineArrowheadColor, lineArrowhead] = getLineProperties(x1, y1, x2, y2);
        setAttributes(line, {"x1": x1, "y1": y1, "x2": directed ? lineX2: x2, "y2": directed ? lineY2: y2, "stroke": directed ? lineArrowheadColor : "black"});
        directed ? setAttributes(line, {"marker-end": `url(#${lineArrowhead})`}) : line.removeAttribute("marker-end");
        updateLabelPosition(x1, y1, x2, y2, label);
    }
}

function updateAllLines(node){
    let x1 = node.cx.baseVal.value, y1 = node.cy.baseVal.value;
    // Incoming (override double connection below):
    for(let i = 0; i < Object.keys(adjacencyList).length; i++){
        if(adjacencyList[i].includes(node.id)){
            let incoming = lines[i][adjacencyList[i].indexOf(node.id)].lineObject;
            let label = lines[i][adjacencyList[i].indexOf(node.id)].label;
            let endNode = svg.getElementById(i);
            let x2 = endNode.cx.baseVal.value, y2 = endNode.cy.baseVal.value;
            updateSingleConnection(incoming, label, x2, y2, x1, y1);
        }
    }

    for(let i = 0; i < adjacencyList[node.id].length; i++){
        let endNodeId = adjacencyList[node.id][i];
        let endNode = svg.getElementById(endNodeId);
        let outgoing = lines[node.id][i].lineObject;
        let outgoingLabel = lines[node.id][i].label;
        let x2 = endNode.cx.baseVal.value, y2 = endNode.cy.baseVal.value;
        // Just outgoing edges.
        if(!adjacencyList[endNodeId].includes(node.id)){
            updateSingleConnection(outgoing, outgoingLabel, x1, y1, x2, y2);
        }else{ // Double connection
            let incoming = lines[endNodeId][adjacencyList[endNodeId].indexOf(node.id)].lineObject;
            let incomingLabel = lines[endNodeId][adjacencyList[endNodeId].indexOf(node.id)].label;
            updateDoubleConnection(incoming, outgoing, incomingLabel, outgoingLabel, x2, y2, x1, y1, endNodeId, node.id);
        }
    }
}

function setWeighted(newWeight){
    if(weighted != newWeight){
        weighted = newWeight;
        for(let i in lines){
            for(let j in lines[i]){
                setAttributes(lines[i][j].label, {"pointer-events": weighted ? "auto" : "none", "opacity": weighted ? 1 : 0});
            }
        }
        if(!weighted && newWeightText != null){
            setAttributes(newWeightText, {"pointer-events": "none", "opacity": 0});
        }
        console.log("CHANGING TO " + (weighted ? "" : "un") + "weighted");
    }
}

function setDirected(newDirected){
    if(directed != newDirected){
        directed = newDirected;
        for(let node of svg.getElementsByTagNameNS(svgns, "circle")){
            updateAllLines(node);
        }
        console.log("CHANGING TO " + (directed ? "" : "un") + "directed");
    }
}

let current = 30;

function createNewNode(random){
    let radius = window.innerWidth/30;
    let group = document.createElementNS(svgns, "g");
    let node = document.createElementNS(svgns, "circle");
    if(random){
        setAttributes(node, {"r": radius, "cx": Math.random() * window.getComputedStyle(svg,null).getPropertyValue("width").slice(0, -2), "cy": Math.random() * window.getComputedStyle(svg,null).getPropertyValue("height").slice(0, -2), "style": "stroke-width:4", "id": numNodes});
    }else{
        setAttributes(node, {"r": radius, "cx": current%window.getComputedStyle(svg,null).getPropertyValue("width").slice(0, -2), "cy": 30 + 30*Math.floor(current/window.getComputedStyle(svg,null).getPropertyValue("width").slice(0, -2)), "style": "stroke-width:4", "id": numNodes});
        current+=75;
    }

    node.classList.add("node");
    if(numNodes == 0){
        node.classList.add("startNode");
        startNode = node;
    }

    let newText = document.createElementNS(svgns, "text");
    setAttributes(newText, {"text-anchor": "middle", "x": parseFloat(node.cx.baseVal.value)-0.5, "y": parseFloat(node.cy.baseVal.value)+4, "font-weight": "bold", "font-size": "16", "class": "disableSelect nodeText"});
    newText.textContent = numNodes;
    adjacencyList[numNodes] = [];
    lines[numNodes++] = [];
    group.appendChild(node);
    group.appendChild(newText);
    svg.appendChild(group);

    group.addEventListener("click", (event) => {
        if(sourceNode == null){
            sourceNode = node;
            newLine = document.createElementNS(svgns, "line");
            setAttributes(newLine, {"x1": node.cx.baseVal.value, "y1": node.cy.baseVal.value, "x2": node.cx.baseVal.value, "y2": node.cy.baseVal.value, "style": "stroke-width:4", "pointer-events": "none", "stroke": "black"});
            if(directed){
                setAttributes(newLine, {"marker-end": "url(#arrowheadBlack_Near)"});
            }

            newWeightText = document.createElementNS(svgns, "text");
            newWeightText.textContent = "1";
            newWeightText.addEventListener("click", (event) => {
                selected = event.target; // We can reference newWeightText when setting fields upon creation because it's not null then. Upon click, however, it is null, so to reference this unique text field again, use event.target.
                console.log(selected);
                selected.textContent += "|";
              
                setAttributes(selectedRect, {"x": parseFloat(selected.getAttribute("x")) - selected.getBBox().width/2, "y": parseFloat(selected.getAttribute("y")) - selected.getBBox().height/2, "width": selected.getBBox().width, "height": selected.getBBox().height});
                svg.appendChild(selectedRect);
                editLabel(selected);
            });

            // LABELS MUST BE IN MEMORY AT ALL TIMES IN ORDER TO RESTORE AT CORRECT SPOT AND WEIGHTS WHEN GOING TO A WEIGHTED ALGORITHM.
            setAttributes(newWeightText, {"x": node.cx.baseVal.value, "y": node.cy.baseVal.value});
            svg.appendChild(newLine);
            // There are two ways to add weight options. The first: remove labels from the HTML entirely. The second: simply make them invisible by setting opacity to 0. The first option also requires looping through all nodes as well to adjust label positions, and proved to be MUCH slower in dense graphs. So, the opacity option is better.
            svg.appendChild(newWeightText);
            if(!weighted){
                setAttributes(newWeightText, {"pointer-events": "none", "opacity": 0});
            }
        }else if(sourceNode != node && !adjacencyList[sourceNode.id].includes(node.id) && (directed || !adjacencyList[node.id].includes(sourceNode.id))){ // Second node to establish connection. Make sure we don't make an edge to ourselves or a duplicate edge. Also only allow edge in undirected graph if no edge between these two nodes exists.
            newLine.id = `edge${sourceNode.id}_${node.id}`;
            playPause.classList.remove("disableElement", "disableSelect");
            adjacencyList[sourceNode.id].push(node.id);
            lines[sourceNode.id].push({lineObject: newLine, label: newWeightText});
            setAttributes(newWeightText, {"node1": sourceNode.id, "node2": node.id});

            if(adjacencyList[node.id].includes(sourceNode.id) && directed){ // Outgoing edge already exists. Incoming being created.
                let index = adjacencyList[node.id].indexOf(`${sourceNode.id}`);
                let outgoing = lines[node.id][index].lineObject; // newLine is incoming.
                let outgoingLabel = lines[node.id][index].label;
                updateDoubleConnection(newLine, outgoing, newWeightText, outgoingLabel, sourceNode.cx.baseVal.value, sourceNode.cy.baseVal.value, node.cx.baseVal.value, node.cy.baseVal.value, sourceNode.id, node.id);
            }else{
                updateSingleConnection(newLine, newWeightText, sourceNode.cx.baseVal.value, sourceNode.cy.baseVal.value, node.cx.baseVal.value, node.cy.baseVal.value);
            }
            newLine = sourceNode = newWeightText = null;
        }
    });
    group.addEventListener("mouseover", (event) => { // mouseenter?
        if(started && stepSlider.value == steps.length){ // Execution done.
            updateHighlight(true, node);
        }
    });
    group.addEventListener("mouseleave", (event) => {
        if(started && stepSlider.value == steps.length){
            console.log("leaving ", node.id);
            updateHighlight(false, node);
        }
    });
}

let addButton = document.getElementsByClassName("add")[0];
addButton.addEventListener("click", (event) => {
    createNewNode(true);
});

// I may consider changing this for speed: have an array of length numNodes, with each node's parent id, DOM element, and edge element from parent to itself. 
// This avoids a document lookup at the expense of more memory used to store the DOM elements.
function updateHighlight(highlight, node){
    // console.log((highlight ? "H" : "Unh") + "ighlighting node ", node.id);
    // Highlight or unhighlight all nodes and edges from startNode to NODE.
    highlight ? node.classList.add("highlightedNode") : node.classList.remove("highlightedNode");
    if(node != startNode && node.hasAttribute("parent")){
        let parentID = node.getAttribute("parent");
        let incomingEdge = document.getElementById(`edge${parentID}_${node.id}`);
        highlight ? incomingEdge.classList.add("highlightedEdge") : incomingEdge.classList.remove("highlightedEdge");
        let parentNode = document.getElementById(parentID);
        updateHighlight(highlight, parentNode);
    }
}

svg.addEventListener("mousemove", (event) => {
    event.preventDefault();
    let X = event.offsetX;
    let Y = event.offsetY;
    if(newLine != null){
        updateSingleConnection(newLine, newWeightText, sourceNode.cx.baseVal.value, sourceNode.cy.baseVal.value, X, Y);
    }else if(draggedItem != null && draggedItem.tagName == "circle"){
        setAttributes(draggedItem, {"cx": X, "cy": Y});
        setAttributes(draggedItem.nextElementSibling, {"x": X-0.5, "y": Y+4});
        setAttributes(draggedItem.parentElement, {"x": X, "y": Y});
        updateAllLines(draggedItem);
    }
});

function doneEditing(){
    if(svg.contains(selectedRect)){
        svg.removeChild(selectedRect);
    }
    if(selected != null){
        selected.textContent = selected.textContent.replace('|', '');
        if(selected.textContent.length == 0){
            selected.textContent = "1";
        }
        editLabel(selected);
        selected = null;
    }
}

svg.addEventListener("mousedown", (event) => {
    if(event.target.tagName == "circle"){
        draggedItem = event.target;
    }
    doneEditing();
});
svg.addEventListener("mouseup", (event) => {
    draggedItem = null;
});

// Called when we edit a label's text to adjust the position.
function editLabel(label){
    let node1Id = label.getAttribute("node1");
    let node2Id = label.getAttribute("node2");
    let node1 = svg.getElementById(node1Id);
    let node2 = svg.getElementById(node2Id);

    let incomingEntry = lines[node1Id][adjacencyList[node1Id].indexOf(node2Id)];
    if(!adjacencyList[node2Id].includes(node1Id)){ // Single connection.
        updateSingleConnection(incomingEntry.lineObject, incomingEntry.label, node1.cx.baseVal.value, node1.cy.baseVal.value, node2.cx.baseVal.value, node2.cy.baseVal.value);
    }else{ // Double connection.
        let outgoingEntry = lines[node2Id][adjacencyList[node2Id].indexOf(node1Id)];
        updateDoubleConnection(outgoingEntry.lineObject, incomingEntry.lineObject, outgoingEntry.label, incomingEntry.label, node2.cx.baseVal.value, node2.cy.baseVal.value, node1.cx.baseVal.value, node1.cy.baseVal.value, node2Id, node1Id);
    }
    setAttributes(selectedRect, {"x": parseFloat(selected.getAttribute("x")) - selected.getBBox().width/2, "y": parseFloat(selected.getAttribute("y")) - selected.getBBox().height/2, "width": selected.getBBox().width, "height": selected.getBBox().height});
}

document.addEventListener("keydown", (event) => {
    if(event.key == "t"){ // Quickly create 100 test nodes.
        for(let i = 0; i < 100; i++){
            createNewNode(false);
        }
    }else if(event.key == "Escape" || event.key == "Enter"){
        for (let element of [newLine, newWeightText]){
            if(element != null && svg.contains(element)){
                svg.removeChild(element);
            }
        }
        doneEditing();
        sourceNode = newLine = newWeightText = null;
    }else if(selected != null){
        // SVG text do not allow editing like input fields do, so I have to mimic it myself with the pipe character as the cursor.
        let cursorIndex = selected.textContent.indexOf("|");
        if(event.key == "ArrowLeft" && cursorIndex != 0){ // Move left.
            selected.textContent = selected.textContent.replace("|","");
            selected.textContent = selected.textContent.slice(0, cursorIndex - 1) + "|" + selected.textContent.slice(cursorIndex-1);
        }else if(event.key == "ArrowRight" && cursorIndex != selected.textContent.length-1){
            selected.textContent = selected.textContent.replace("|","");
            selected.textContent = selected.textContent.slice(0, cursorIndex + 1) + "|" + selected.textContent.slice(cursorIndex+1);
        }else if(event.key == "Backspace" || event.key == "Delete" && cursorIndex > 0){
            selected.textContent = selected.textContent.slice(0, cursorIndex-1) + selected.textContent.slice(cursorIndex);
            editLabel(selected);
        }else if(isFinite(event.key) && selected.textContent.length < 6){ // 0 - 9
            selected.textContent = selected.textContent.slice(0, cursorIndex) + event.key + selected.textContent.slice(cursorIndex);
            editLabel(selected);
        }
    }else if(event.key == "ArrowRight"){
        // Step forward. Pause execution.
        playPause.classList.add("play");
    }else if(event.key == "ArrowLeft"){
        // Step back. Pause execution.
        playPause.classList.add("play");
    }else if(event.key == " "){
        // Toggle play/pause.
    }
});

function sleep(ms){
    return new Promise(r => setTimeout(r, ms));
}

function waitListener(Element, ListenerName) {
    return new Promise(function (resolve, reject) {
        var listener = event => {
            Element.removeEventListener(ListenerName, listener);
            resolve(event);
        };
        Element.addEventListener(ListenerName, listener);
    });
}

function BFS(){}

// Unweighted. Directed or undirected. Focus on directed only for now, and we can add the option for an algorithm to be either directed or undirected later.

// Step-based with codetrace:
async function DFS(node){
    // Initially, all nodes & edges undiscovered.
    // Highlight node as current:
    steps.push({"elements": [node, node, node], "actions": ["add", "add", "remove"], "classList": ["discoveredNode", "currentNode", "goingTo"], "index": 0});

    discovered.push(node.id);
    // Loop through the edges:
    for(let i in adjacencyList[node.id]){
        let edge = lines[node.id][i].lineObject;

        // Dehighlight node, highlight current edge.
        steps.push({"elements": [node, edge, edge], "actions": ["remove", "add", "add"], "classList": ["currentNode", "discoveredEdge", "currentEdge"], "index": 1});

        // Go on to neighbor node:
        let neighbor = document.getElementById(adjacencyList[node.id][i]);
        if(!discovered.includes(neighbor.id)){
            neighbor.setAttribute("parent", node.id);
            steps.push({"elements": [edge, neighbor], "actions": ["remove", "add"], "classList": ["currentEdge", "goingTo"], "index": 2});
            await DFS(neighbor);
            steps[steps.length-1] = {"elements": [neighbor, neighbor, node], "actions": ["remove", "add", "add"], "classList": ["currentNode", "finishedNode", "currentNode"], "index": 4}; // Override prior entry to make node current.
        }else{
            // Node already discovered, so this edge will not actually be explored.
            steps.push({"elements": [edge, node], "actions": ["remove", "add"], "classList": ["currentEdge", "currentNode"], "index": 3});
        }
    }
   
    // Node finished:
    steps.push({"elements": [node, node], "actions": ["remove", "add"], "classList": ["currentNode", "finishedNode"], "index": 4});  // If node is startNode, this will not be overridden. Mark node as finished.
    return Promise.resolve();
}

function doStep(step){
    if(step > 0){
        code.getElementsByTagName("p")[steps[step-1]["index"]].removeAttribute("style");
    }
    code.getElementsByTagName("p")[steps[step]["index"]].setAttribute("style", "background:green;");
    for(let j = 0; j < steps[step]["elements"].length; j++){
        if(steps[step]["actions"][j] == "add"){
            steps[step]["elements"][j].classList.add(steps[step]["classList"][j]);
        }else{
            steps[step]["elements"][j].classList.remove(steps[step]["classList"][j]);
        }
    }
}

let oldValue = 0;
let baseWait = 2500;
let speedSlider = document.getElementById("speedSlider");

async function execute(){
    while(stepSlider.value < steps.length){
        // Execute step at index stepSlider.value.
        doStep(stepSlider.value);
        stepSlider.value++;
        console.log("Going from ", oldValue, "to ", stepSlider.value);
        oldValue = parseInt(stepSlider.value);
        await sleep(baseWait/speedSlider.value);
        if(playPause.classList.contains("play")){
            await waitListener(playPause,"click");
        }
        console.log("waitListener done. stepSlider.value = ", stepSlider.value);
    }
    playPause.classList.add("play");
}

stepSlider.oninput = (event) => {
    console.log(oldValue, stepSlider.value);
    let max = parseInt(stepSlider.value);
    while(oldValue < max){
        console.log("oldValue = ", oldValue, " and stepSlider.value = ", stepSlider.value);
        doStep(oldValue);
        oldValue++;
    }
}

function Dijkstra(){}

function Bellman_Ford(){}