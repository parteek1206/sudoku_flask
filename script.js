// static/script.js

// ================= State =================
let puzzle = null;
let solution = null;
let initial = null;
let undoStack = [];
let redoStack = [];
let mistakes = 0;
const MAX_MISTAKES = 3;

let score = 0;
let difficultyMultiplier = 1;
let streak = 0;
let boxCompleted = Array(3).fill(null).map(() => Array(3).fill(false));
let rowCompleted = Array(9).fill(false);
let colCompleted = Array(9).fill(false);

// Timer state
let timerInterval;
let seconds = 0;
let timerStarted = false;
let timerEverStarted = false;
let isPaused = false;

// ================= Helpers =================
function pad2(n){ return n.toString().padStart(2,'0'); }

function updateTimerDisplay(){
    const el = document.getElementById('timer');
    if(el) el.innerText = `Time: ${pad2(Math.floor(seconds/60))}:${pad2(seconds%60)}`;
}

function startTimer(){
    if(timerStarted) return;
    timerStarted = true;
    timerEverStarted = true;
    clearInterval(timerInterval);
    timerInterval = setInterval(()=>{ seconds++; updateTimerDisplay(); }, 1000);
}

function resetTimer(){
    clearInterval(timerInterval);
    seconds = 0;
    timerStarted = false;
    timerEverStarted = false;
    updateTimerDisplay();
}

function stopTimer(){
    clearInterval(timerInterval);
    timerStarted = false;
}

// ================= Pause / Resume =================
function togglePause(){
    const pauseBtn = document.getElementById('pauseBtn');
    if(!pauseBtn) return;

    if(!isPaused){
        isPaused = true;
        if(timerStarted) stopTimer();
        pauseBtn.innerText = '▶ Resume';
        document.querySelectorAll('#grid .cell').forEach(inp => { if(!inp.readOnly) inp.disabled = true; });
        const statusEl = document.getElementById('status');
        if(statusEl) statusEl.innerText = 'Paused';
    } else {
        isPaused = false;
        document.querySelectorAll('#grid .cell').forEach(inp => { if(!inp.readOnly) inp.disabled = false; });
        pauseBtn.innerText = '|| Pause';
        if(timerEverStarted) startTimer();
        const statusEl = document.getElementById('status');
        if(statusEl) statusEl.innerText = '';
    }
}

// ================= Load New Board =================
async function loadNew(level='easy'){
    hideWinOptions();
    isPaused = false;
    const pauseBtn = document.getElementById('pauseBtn');
    if(pauseBtn) pauseBtn.innerText = '|| Pause';
    stopTimer();
    resetTimer();
    undoStack = [];
    redoStack = [];
    mistakes = 0;
    score = 0;
    streak = 0;
    boxCompleted = Array(3).fill(null).map(() => Array(3).fill(false));
    rowCompleted = Array(9).fill(false);
    colCompleted = Array(9).fill(false);

    document.getElementById('mistakes').innerText = `Mistakes: ${mistakes}`;
    document.getElementById('score').innerText = `Score: ${score}`;
    document.getElementById('status').innerText = '';

    switch(level){
        case 'easy': difficultyMultiplier = 1; break;
        case 'medium': difficultyMultiplier = 2; break;
        case 'hard': difficultyMultiplier = 3; break;
        default: difficultyMultiplier = 1;
    }

    try{
        const res = await fetch(`/api/new/${level}`);
        const data = await res.json();
        if(!data.solution || !Array.isArray(data.solution)){
            alert('Server sent an invalid puzzle, reloading...');
            loadNew(level);
            return;
        }

        puzzle = data.board;
        solution = data.solution;
        initial = JSON.parse(JSON.stringify(puzzle));
        renderGrid();
        document.querySelectorAll('#grid .cell').forEach(inp => { if(!inp.readOnly) inp.disabled = false; });
    }catch(e){
        alert('Error loading puzzle: '+e);
    }
}

// ================= Render Grid =================
function renderGrid(){
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    for(let r=0;r<9;r++){
        for(let c=0;c<9;c++){
            const val = puzzle[r][c];
            const input = document.createElement('input');
            input.type = 'text';
            input.maxLength = 1;
            input.className = 'cell';
            input.dataset.r = r;
            input.dataset.c = c;

            if(val !== 0){
                input.value = val;
                input.readOnly = true;
                input.classList.add('prefilled');
            } else {
                input.value = '';
            }

            input.addEventListener('input', onCellInput);
            input.addEventListener('focus', ()=>{ input.select(); });
            grid.appendChild(input);
        }
    }
    enableFirstMoveStart();
}

// ================= Input Handler =================
function onCellInput(e){
    if(isPaused) { e.target.value = ''; return; }

    const input = e.target;
    const r = Number(input.dataset.r);
    const c = Number(input.dataset.c);
    let v = input.value.trim();
    if(!/^[1-9]$/.test(v)){ input.value = ''; return; }
    v = Number(v);

    if(!timerStarted) startTimer();

    const prev = puzzle[r][c] || 0;
    undoStack.push({r,c,prev});
    redoStack = [];
    puzzle[r][c] = v;

    if(!isValidChoice(puzzle, r, c, v)){
        input.classList.add('invalid');
        mistakes++;
        streak = 0; // streak reset on wrong entry
        document.getElementById('mistakes').innerText = `Mistakes: ${mistakes}`;
        if(mistakes >= MAX_MISTAKES) gameOver();
        return;
    } else {
        input.classList.remove('invalid');
        streak++; // increment streak

        // ✅ Score per valid entry + bonuses
        let points = difficultyMultiplier===1?5 : difficultyMultiplier===2?10 : 15;
        if(seconds < 5) points +=5;
        else if(seconds < 10) points +=2;

        score += points;

        // Box completion bonus
        const boxR = Math.floor(r/3), boxC = Math.floor(c/3);
        if(!boxCompleted[boxR][boxC] && isBoxComplete(boxR, boxC)){
            boxCompleted[boxR][boxC] = true;
            score += difficultyMultiplier===1?50 : difficultyMultiplier===2?100 : 150;
        }

        // Row completion bonus
        if(!rowCompleted[r] && isRowComplete(r)){
            rowCompleted[r] = true;
            score += difficultyMultiplier===1?50 : difficultyMultiplier===2?100 : 150;
        }

        // Column completion bonus
        if(!colCompleted[c] && isColComplete(c)){
            colCompleted[c] = true;
            score += difficultyMultiplier===1?50 : difficultyMultiplier===2?100 : 150;
        }

        // Streak bonuses
        if(streak === 3) score += 10;
        else if(streak === 5) score += 25;
        else if(streak === 10) score += 50;

        animateScore(score);
    }

    // Check if game is complete
    if(isComplete(puzzle)){
        if(isPuzzleCorrect(puzzle)){
            stopTimer();
            showWinOptions();
        } else {
            document.getElementById('status').innerText = 'Grid full but incorrect.';
        }
    }
} 

// ================= Score Update =================
function updateScore(r,c,v){
    score += pointsToAdd; // add new points to current score
    animateScore(score);
    // 1️⃣ Individual number
    let points = difficultyMultiplier===1?5: difficultyMultiplier===2?10:15;
    if(seconds<5) points +=5;
    else if(seconds<10) points +=2;

    score += points;

    // 2️⃣ Box completion
    const boxR = Math.floor(r/3), boxC = Math.floor(c/3);
    if(!boxCompleted[boxR][boxC] && isBoxComplete(boxR,boxC)){
        boxCompleted[boxR][boxC] = true;
        let boxBonus = difficultyMultiplier===1?50:difficultyMultiplier===2?100:150;
        score += boxBonus;
    }

    // 3️⃣ Row completion
    if(!rowCompleted[r] && isRowComplete(r)){
        rowCompleted[r] = true;
        let rowBonus = difficultyMultiplier===1?50:difficultyMultiplier===2?100:150;
        score += rowBonus;
    }

    // 4️⃣ Column completion
    if(!colCompleted[c] && isColComplete(c)){
        colCompleted[c] = true;
        let colBonus = difficultyMultiplier===1?50:difficultyMultiplier===2?100:150;
        score += colBonus;
    }

    // 5️⃣ Streak bonuses
    if(streak === 3) score += 10;
    else if(streak === 5) score += 25;
    else if(streak === 10) score += 50;

    animateScore(score);
}

// ================= Check Completion Helpers =================
function isBoxComplete(boxR, boxC){
    for(let r=boxR*3;r<boxR*3+3;r++){
        for(let c=boxC*3;c<boxC*3+3;c++){
            if(puzzle[r][c]===0 || !isValidChoice(puzzle,r,c,puzzle[r][c])) return false;
        }
    }
    return true;
}

function isRowComplete(r){
    for(let c=0;c<9;c++){
        if(puzzle[r][c]===0 || !isValidChoice(puzzle,r,c,puzzle[r][c])) return false;
    }
    return true;
}

function isColComplete(c){
    for(let r=0;r<9;r++){
        if(puzzle[r][c]===0 || !isValidChoice(puzzle,r,c,puzzle[r][c])) return false;
    }
    return true;
}

// ================= Validation =================
function isValidChoice(board,row,col,num){
    for(let j=0;j<9;j++) if(j!==col && board[row][j]===num) return false;
    for(let i=0;i<9;i++) if(i!==row && board[i][col]===num) return false;
    const sr = Math.floor(row/3)*3, sc = Math.floor(col/3)*3;
    for(let i=sr;i<sr+3;i++){
        for(let j=sc;j<sc+3;j++){
            if(!(i===row && j===col) && board[i][j]===num) return false;
        }
    }
    return true;
}

function isComplete(board){
    for(let i=0;i<9;i++) for(let j=0;j<9;j++) if(board[i][j]===0) return false;
    return true;
}

function isPuzzleCorrect(board){
    if(solution){
        for(let i=0;i<9;i++) for(let j=0;j<9;j++) if(board[i][j]!==solution[i][j]) return false;
        return true;
    }
    return false;
}

// ================= Highlight & Reset =================
function highlightAllCorrect(){
    document.querySelectorAll('#grid .cell').forEach(inp => { inp.style.background='#d4ffd4'; });
}

function resetBoard(){
    if(!initial) return;
    puzzle = JSON.parse(JSON.stringify(initial));
    undoStack = [];
    redoStack = [];
    mistakes = 0;
    score = 0; // reset score
    streak = 0; // reset streak
    boxCompleted = Array(3).fill(null).map(() => Array(3).fill(false));
    rowCompleted = Array(9).fill(false);
    colCompleted = Array(9).fill(false);

    document.getElementById('mistakes').innerText = `Mistakes: ${mistakes}`;
    document.getElementById('score').innerText = `Score: ${score}`;
    document.getElementById('status').innerText = '';
    renderGrid();
    isPaused = false;
    const pauseBtn = document.getElementById('pauseBtn');
    if(pauseBtn) pauseBtn.innerText = '|| Pause';
    document.querySelectorAll('#grid .cell').forEach(inp => { if(!inp.readOnly) inp.disabled=false; });
    resetTimer();
    hideWinOptions();
}

// ================= Undo / Redo =================
function undo(){
    if(undoStack.length===0) return;
    const last = undoStack.pop();
    const {r,c,prev} = last;
    redoStack.push({r,c,prev:puzzle[r][c]||0});
    puzzle[r][c] = prev;
    const cell = document.querySelectorAll('#grid .cell')[r*9+c];
    cell.value = prev===0?'':prev;
    cell.classList.remove('invalid');
}

function redo(){
    if(redoStack.length===0) return;
    const last = redoStack.pop();
    const {r,c,prev} = last;
    undoStack.push({r,c,prev:puzzle[r][c]||0});
    puzzle[r][c] = prev;
    const cell = document.querySelectorAll('#grid .cell')[r*9+c];
    cell.value = prev===0?'':prev;
    if(!isValidChoice(puzzle,r,c,prev)){
        cell.classList.add('invalid');
        mistakes++;
        document.getElementById('mistakes').innerText = `Mistakes: ${mistakes}`;
        if(mistakes>=MAX_MISTAKES) gameOver();
    } else cell.classList.remove('invalid');
}

// ================= Game Over =================
function gameOver(){
    stopTimer();
    document.getElementById('status').innerText = 'Game Over — too many mistakes';
    document.querySelectorAll('#grid .cell').forEach(inp=>{ if(!inp.readOnly) inp.disabled=true; });
}

// ================= Hint =================
async function getHint(){
    if(!puzzle) return;
    const res = await fetch('/api/hint',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({board:puzzle})});
    const data = await res.json();
    if(data.error){ alert('No hint available'); return; }
    const {row:r,col:c,value:v} = data;
    undoStack.push({r,c,prev:puzzle[r][c]||0});
    redoStack=[];
    puzzle[r][c]=v;
    const cell=document.querySelectorAll('#grid .cell')[r*9+c];
    cell.value=v; cell.classList.remove('invalid');
    cell.style.background='#fff0b3';
    setTimeout(()=>{cell.style.background='';},900);
}

// ================= Check Board =================
function checkBoard(){
    const board = getBoardFromDOM();
    let anyInvalid=false;
    for(let r=0;r<9;r++){
        for(let c=0;c<9;c++){
            const v = board[r][c];
            const idx = r*9+c;
            const cell = document.querySelectorAll('#grid .cell')[idx];
            cell.classList.remove('invalid');
            if(v!==0 && !isValidChoice(board,r,c,v)){
                cell.classList.add('invalid');
                anyInvalid=true;
            }
        }
    }
    document.getElementById('status').innerText = anyInvalid?'There are invalid placements.':'No rule violations detected.';
}

// ================= Solve =================
async function solveFromServer(){
    const board = puzzle;
    const res = await fetch('/api/solve',{method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify({board})});
    const data = await res.json();
    if(data.error){ alert('Cannot solve: '+data.error); return; }
    puzzle = data.solved;
    renderGrid();
    stopTimer();
    document.getElementById('status').innerText='Solved by computer';
}

// ================= Score Calculation =================
function calculateScore(){
    const timePenalty = seconds * 2;
    const mistakePenalty = mistakes * 250;
    const baseScore = 10000;
    return Math.max(0, Math.round(baseScore - timePenalty - mistakePenalty));
}

// ================= Animated Score =================
function animateScore(finalScore){
    const scoreEl = document.getElementById('score');
    if(!scoreEl) return;

    // Current displayed score
    let currentDisplayed = Number(scoreEl.innerText.replace('Score: ',''));

    const increment = Math.max(1, Math.floor((finalScore - currentDisplayed)/50));

    const interval = setInterval(() => {
        currentDisplayed += increment;
        if(currentDisplayed >= finalScore){
            currentDisplayed = finalScore;
            clearInterval(interval);
        }
        scoreEl.innerText = `Score: ${currentDisplayed}`;
    }, 30);
}

// ================= Win Options =================
function showWinOptions(){
    const winDiv=document.getElementById('winOptions');
    if(winDiv) winDiv.style.display='block';
}

function hideWinOptions(){
    const winDiv=document.getElementById('winOptions');
    if(winDiv) winDiv.style.display='none';
}

function exitGame(){
    alert('Thanks for playing!');
}

// ================= Enable Timer on First Move =================
function enableFirstMoveStart(){
    const inputs = document.querySelectorAll('#grid .cell');
    inputs.forEach(inp=>{
        if(!inp.readOnly){
            inp.addEventListener('input', function f(){
                if(!timerStarted && inp.value.trim()!=='') startTimer();
                inp.removeEventListener('input',f);
            });
        }
    });
}

// ================= Initialize =================
document.addEventListener('DOMContentLoaded',()=>{ loadNew('easy'); });
