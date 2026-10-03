        const menuScreen = document.getElementById('menuScreen');
        const gameScreen = document.getElementById('gameScreen');
        const boardElement = document.getElementById('bingoBoard');
        const winMessage = document.getElementById('winMessage');
        const gameTitle = document.getElementById('gameTitle');
        const matchLog = document.getElementById('matchLog');
        const emptyLogText = document.getElementById('emptyLogText');
        const tileSelector = document.getElementById('tileSelector');

        let currentCategory = '';
        let hasExplodedBoard = false;
        let activeWinningLines = new Set();
        let fallTimeout = null;
        let currentBoardTiles = [];
        
        let isBouncing = false;
        let bouncePos = { x: 0, y: 0 };
        let bounceVel = { x: 3, y: 3 };
        let bounceReqId = null;

        // Confirmation state
        let activeConfId = null;
        let confTimeout = null;

        // Tile Exclusions State
        let excludedTiles = { soccer: [], f1: [], hockey: [] };

        const pool = {
            soccer: [
                "Yellow Card", "Corner Kick", "Header Goal", "Offside", "VAR Check", "Crowd Poznan", "Goalie Goal", "Super Sub",
                "Clean Sheet", "Penalty Kick", "Bicycle Kick", "Nutmeg", "Hat Trick", "Throw In", "Brace", "Bus Parking", "Goal",
                "Fan Smoke", "Slide Tackle", "Wall Block", "Post Hit", "Own Goal", "Time Wasting", "Overhead Kick",
                "Manager Fuming", "Substitution", "Diving", "Crossbar", "Sideline Card", "Face-to-face", "Set-piece Goal",
                "Jersey Swap", "Red Card", "Handball", "Goalkeeper Save", "Magic Spray", "Card From Stands", "Stoppage Time Goal",
                "Italian Gestures", "Extended Injury", "Neymar", "Triple Neymar", "English Chants", "English Gestures",
                "Shirtless Fan", "Facepaint", "Special Goal Celebration", "Knee Slide", "Weather Event", "Jurgen Fisting",
                "BBOTT", "Drury Poetry", "Injury Sub", "Hair Pull", "'You Shoulda Passed It To Me'", "Laying In The Wall",
                "Lee/Graham-isms", "Back Heel", "High Boot", "Scorpion Kick", "Ball Baby",
            ],
            f1: [
                "Pit Stop", "Safety Car", "Double DNF", "Blue Flag", "Overcut", "Red Flag", "0cm Close Call", "Wall Hit",
                "Box Box", "Angry Radio", "Locked Up", "Track Limits", "Radio Rant", "Hat Fidget", "George Russel Wingspan",
                "Yellow Flag", "DNF", "Front Wing Damage", "Gravel Trap", "Toto Moment", "Bad Tempered Isak Rant",
                "Double Stack", "Chequered Flag", "Tire Deg", "Apex Missed", "Zak Talk Mid-Race", "'Idiot!'",
                "Spin", "Late Braking", "Strategy Error", "Champagne Spray", "Bernie Collins Chat", "Bad Crofty Joke",
                "Leclerc Resentment", "Blown Tire", "Oscar Stoic Face", "Don't Talk To Me", "Lewis Sadness", "Angry Max",
            ],
            hockey: [
                "Power Play", "Slap Shot", "Body Check", "Hat Trick", "Empty Net", "Blood",
                "1-on-1", "Offside", "Face-off Win", "Icing", "Penalty Kill", "Broken Stick", "Broken Nose",
                "Zamboni", "Puck in Crowd", "High Sticking", "Breakaway", "Five Hole", "Upper Body Injury",
                "Gloves Off", "Boarding", "One Timer", "Iron Hit", "Shutout", "Lower Body Injury", "Pushing",
                "Diving Save", "Glove Save", "Jersey Tug", "Fight!", "Assist", "Missing Teeth", "Glass Broken",
                "2m Penalty", "5m Major", "10m Major", "Hip Check", "Goalie Fight", "Black Eye",
                "Haymaker", "Cross Checking", "Puck Catch", "Cleanup Crew", "Goal!", "Roughing",
                "Overtime", "Too Many Players", "Puck Flip", "Hooking", "Unstable Net", "Multiple Penalties",
                "Post Hit", "Crossbar Hit", "Boucher!"
            ]
        };

        function requestConfirmation(btnId, action, originalText) {
            const btn = document.getElementById(btnId);
            
            if (activeConfId === btnId) {
                action();
                clearConfirmation();
                return;
            }

            clearConfirmation();
            
            activeConfId = btnId;
            btn.textContent = "Confirm?";
            btn.classList.add('confirming');
            
            confTimeout = setTimeout(() => {
                clearConfirmation();
            }, 3000);

            const cancelOnBody = (e) => {
                if (e.target !== btn) {
                    clearConfirmation();
                    document.body.removeEventListener('click', cancelOnBody);
                }
            };
            setTimeout(() => document.body.addEventListener('click', cancelOnBody), 10);
        }

        function clearConfirmation() {
            if (activeConfId) {
                const btn = document.getElementById(activeConfId);
                if (btn) {
                    btn.textContent = activeConfId === 'newCardBtn' ? 'New Card' : 'Clear';
                    btn.classList.remove('confirming');
                }
            }
            activeConfId = null;
            if (confTimeout) clearTimeout(confTimeout);
        }

        function showMenu() {
            gameScreen.classList.add('hidden');
            menuScreen.classList.remove('hidden');
            stopBouncing();
            winMessage.classList.add('hidden');
            clearWinLines();
            clearTimeout(fallTimeout);
            clearConfirmation();
            toggleExclusionModal(false);
        }

        function startGame(category) {
            currentCategory = category;
            menuScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');
            gameTitle.textContent = category === 'f1' ? 'Formula 1' : category;
            generateNewCard();
        }

        function shuffle(array) {
            return array.sort(() => Math.random() - 0.5);
        }

        function populateDropdown() {
            tileSelector.innerHTML = '<option value="" disabled selected>Track event...</option>';
            const allPoolTiles = [...new Set(pool[currentCategory])].sort();
            const cardTiles = Array.from(document.querySelectorAll('.cell'))
                .map(c => c.textContent)
                .filter(t => t !== 'FREE!');

            allPoolTiles.forEach(tile => {
                const opt = document.createElement('option');
                opt.value = tile;
                const isUsable = cardTiles.includes(tile);
                const prefix = isUsable ? '✅ ' : '❌ ';
                opt.textContent = prefix + tile;
                tileSelector.appendChild(opt);
            });
        }

        function handleDropdownMark(select) {
            const val = select.value;
            if (!val) return;
            const cells = Array.from(document.querySelectorAll('.cell'));
            const targetCell = cells.find(c => c.textContent === val);
            if (targetCell) {
                if (!targetCell.classList.contains('marked')) {
                    toggleMark(targetCell, parseInt(targetCell.id.split('-')[1]));
                }
            } else {
                addToLog(val, -1);
            }
            select.selectedIndex = 0;
        }

        function getTimestamp() {
            const now = new Date();
            return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }

        function addBingoToLog(description) {
            emptyLogText.classList.add('hidden');
            const entry = document.createElement('div');
            entry.className = 'history-item flex items-center justify-between bg-blue-500/20 px-3 py-2 rounded-lg border border-blue-500/30';
            
            entry.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-[10px]">🏆</span>
                    <span class="text-blue-100 text-xs font-black uppercase tracking-wider">BINGO!</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-[9px] text-blue-300 font-mono italic">${description}</span>
                    <span class="text-[9px] text-blue-400 font-mono bg-blue-900/50 px-1.5 py-0.5 rounded border border-blue-400/20">${getTimestamp()}</span>
                </div>
            `;
            matchLog.prepend(entry);
        }

        function addToLog(text, cellIndex) {
            emptyLogText.classList.add('hidden');
            const entry = document.createElement('div');
            entry.className = 'history-item flex items-center justify-between bg-white/5 px-3 py-2 rounded-lg border border-white/5';
            
            const isOnBoard = cellIndex !== -1;
            const prefix = isOnBoard ? '✅' : '❌';
            const textStyle = isOnBoard ? 'text-white' : 'text-slate-500 italic';
            
            let locInfo = "Not On Card";
            if (isOnBoard) {
                const row = Math.floor(cellIndex / 5) + 1;
                const col = (cellIndex % 5) + 1;
                locInfo = `R${row} C${col}`;
            }
            
            entry.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-[10px] opacity-70">${prefix}</span>
                    <span class="${textStyle} text-xs font-bold">${text}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-[9px] text-slate-500 font-mono uppercase bg-slate-800/50 px-1.5 py-0.5 rounded border border-white/5">${locInfo}</span>
                    <span class="text-[9px] text-slate-600 font-mono">${getTimestamp()}</span>
                </div>
            `;
            matchLog.prepend(entry);
        }

        function removeFromLog(text) {
            const items = matchLog.querySelectorAll('.history-item');
            for (let item of items) {
                const label = item.querySelector('span.text-xs')?.textContent;
                if (label === text) {
                    item.remove();
                    break;
                }
            }
            if (matchLog.querySelectorAll('.history-item').length === 0) {
                emptyLogText.classList.remove('hidden');
            }
        }

        // Exclusion Modal Logic
        function toggleExclusionModal(show) {
            const modal = document.getElementById('exclusionModal');
            if (show) {
                renderExclusionList();
                modal.classList.remove('hidden');
            } else {
                modal.classList.add('hidden');
            }
        }

        function renderExclusionList() {
            const listContainer = document.getElementById('exclusionList');
            const saveBtn = document.getElementById('applyExclusionsBtn');
            const warningText = document.getElementById('exclusionWarning');
            listContainer.innerHTML = '';

            const currentPool = [...new Set(pool[currentCategory] || [])].sort();
            const excludedListForCat = excludedTiles[currentCategory] || [];
            const availableCount = currentPool.length - excludedListForCat.length;

            // Update Header counts
            document.getElementById('excludedCount').textContent = excludedListForCat.length;
            document.getElementById('remainingCount').textContent = availableCount;

            if (availableCount < 24) {
                saveBtn.disabled = true;
                saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
                warningText.classList.remove('hidden');
            } else {
                saveBtn.disabled = false;
                saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                warningText.classList.add('hidden');
            }

            currentPool.forEach(tile => {
                const isExcluded = excludedListForCat.includes(tile);
                const tileBtn = document.createElement('button');

                if (isExcluded) {
                    tileBtn.className = "flex items-center justify-between text-left p-3 rounded-xl border-2 border-red-500/80 bg-red-500/10 text-red-300 font-bold text-xs transition-all duration-150 shadow-md";
                    tileBtn.innerHTML = `
                        <span class="truncate pr-1">${tile}</span>
                        <span class="text-red-500 font-black text-sm">❌</span>
                    `;
                } else {
                    tileBtn.className = "flex items-center justify-between text-left p-3 rounded-xl border border-white/5 bg-[#2d3748]/50 hover:bg-[#2d3748] text-slate-300 hover:text-white font-semibold text-xs transition-all duration-150";
                    tileBtn.innerHTML = `
                        <span class="truncate pr-1">${tile}</span>
                        <span class="text-emerald-500/50 font-black text-sm">✓</span>
                    `;
                }

                tileBtn.onclick = () => {
                    toggleTileExclusion(tile);
                };

                listContainer.appendChild(tileBtn);
            });
        }

        function toggleTileExclusion(tile) {
            const list = excludedTiles[currentCategory];
            const idx = list.indexOf(tile);
            if (idx > -1) {
                list.splice(idx, 1);
            } else {
                list.push(tile);
            }
            renderExclusionList();
        }

        function clearAllExclusions() {
            excludedTiles[currentCategory] = [];
            renderExclusionList();
        }

        function applyExclusionsAndRefresh() {
            toggleExclusionModal(false);
            generateNewCard();
        }

        function generateNewCard() {
            boardElement.innerHTML = '';
            matchLog.innerHTML = '';
            matchLog.appendChild(emptyLogText);
            emptyLogText.classList.remove('hidden');
            stopBouncing();
            winMessage.classList.add('hidden');
            clearWinLines();
            hasExplodedBoard = false;
            clearTimeout(fallTimeout);
            
            // Filter pool dynamically using active exclusions
            const activePool = pool[currentCategory].filter(tile => !excludedTiles[currentCategory].includes(tile));
            currentBoardTiles = shuffle([...activePool]).slice(0, 24);

            let optionIdx = 0;
            for (let i = 0; i < 25; i++) {
                const cell = document.createElement('div');
                cell.className = 'cell rounded-lg sm:rounded-xl';
                cell.id = `cell-${i}`;
                
                if (i === 12) {
                    cell.textContent = 'FREE!';
                    cell.classList.add('free-space', 'marked');
                } else {
                    cell.textContent = currentBoardTiles[optionIdx++];
                    cell.onclick = () => toggleMark(cell, i);
                }
                
                boardElement.appendChild(cell);
            }
            populateDropdown();
        }

        function toggleMark(cell, index) {
            if (cell.classList.contains('falling')) return;
            const isMarking = !cell.classList.contains('marked');
            cell.classList.toggle('marked');
            if (isMarking) {
                addToLog(cell.textContent, index);
            } else {
                removeFromLog(cell.textContent);
            }
            checkWin();
        }

        function resetMarkers() {
            const cells = document.querySelectorAll('.cell');
            cells.forEach((cell, index) => {
                cell.classList.remove('falling', 'marked');
                cell.style = '';
                if (index === 12) cell.classList.add('marked');
            });
            matchLog.innerHTML = '';
            matchLog.appendChild(emptyLogText);
            emptyLogText.classList.remove('hidden');
            stopBouncing();
            winMessage.classList.add('hidden');
            clearWinLines();
            hasExplodedBoard = false;
            clearTimeout(fallTimeout);
        }

        function clearWinLines() {
            activeWinningLines.clear();
            const lines = boardElement.querySelectorAll('.win-line');
            lines.forEach(l => l.remove());
        }

        function triggerConfetti(isExplosion = false) {
            if (isExplosion) {
                const end = Date.now() + (2 * 1000);
                const colors = ['#3b82f6', '#52FF5C', '#f87171', '#fbbf24', '#A9E5FF'];
                (function frame() {
                  confetti({ particleCount: 15, angle: 60, spread: 55, origin: { x: 0 }, colors });
                  confetti({ particleCount: 15, angle: 120, spread: 55, origin: { x: 1 }, colors });
                  if (Date.now() < end) requestAnimationFrame(frame);
                }());
                boardElement.classList.add('explode-shake');
                setTimeout(() => boardElement.classList.remove('explode-shake'), 600);
                return;
            }
            confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 }, colors: ['#A9E5FF', '#3b82f6', '#ffffff'] });
        }

        function handleGravityFall() {
            const cells = document.querySelectorAll('.cell');
            const lines = document.querySelectorAll('.win-line');
            lines.forEach(line => {
                line.style.transition = 'opacity 0.5s ease';
                line.style.opacity = '0';
                setTimeout(() => line.remove(), 500);
            });
            cells.forEach((cell, i) => {
                const delay = Math.random() * 0.5;
                const tx = (Math.random() - 0.5) * 200;
                const rot = (Math.random() - 0.5) * 45;
                const rotFinal = (Math.random() - 0.5) * 720;
                setTimeout(() => {
                    cell.style.setProperty('--tw-tx', `${tx}px`);
                    cell.style.setProperty('--tw-rot', `${rot}deg`);
                    cell.style.setProperty('--tw-rot-final', `${rotFinal}deg`);
                    cell.classList.add('falling');
                }, delay * 1000);
            });
            setTimeout(startBouncing, 500);
        }

        function startBouncing() {
            if (isBouncing) return;
            isBouncing = true;
            bouncePos.x = (window.innerWidth - winMessage.offsetWidth) / 2;
            bouncePos.y = (window.innerHeight - winMessage.offsetHeight) / 2;
            bounceVel.x = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 2);
            bounceVel.y = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 2);
            animateBounce();
        }

        function stopBouncing() {
            isBouncing = false;
            cancelAnimationFrame(bounceReqId);
            winMessage.style.left = ''; winMessage.style.top = ''; winMessage.style.bottom = '1.5rem';
            winMessage.style.transform = ''; winMessage.classList.remove('animate-bounce');
        }

        function animateBounce() {
            if (!isBouncing) return;
            const rect = winMessage.getBoundingClientRect();
            const w = window.innerWidth;
            const h = window.innerHeight;
            bouncePos.x += bounceVel.x;
            bouncePos.y += bounceVel.y;
            let hit = false;
            if (bouncePos.x <= 0 || bouncePos.x + rect.width >= w) {
                bounceVel.x *= -1;
                bouncePos.x = Math.max(0, Math.min(bouncePos.x, w - rect.width));
                hit = true;
            }
            if (bouncePos.y <= 0 || bouncePos.y + rect.height >= h) {
                bounceVel.y *= -1;
                bouncePos.y = Math.max(0, Math.min(bouncePos.y, h - rect.height));
                hit = true;
            }
            if (hit) {
                const colors = ['#52FF5C', '#3b82f6', '#f87171', '#fbbf24', '#A9E5FF'];
                const color = colors[Math.floor(Math.random() * colors.length)];
                winMessage.style.color = color;
                winMessage.style.borderColor = `${color}4D`;
                winMessage.style.boxShadow = `0 0 30px ${color}66`;
            }
            winMessage.style.left = bouncePos.x + 'px';
            winMessage.style.top = bouncePos.y + 'px';
            winMessage.style.bottom = 'auto';
            bounceReqId = requestAnimationFrame(animateBounce);
        }

        function addWinLine(type, index) {
            const lineId = `${type}-${index}`;
            if (activeWinningLines.has(lineId)) return;
            activeWinningLines.add(lineId);
            
            // Log the bingo
            let desc = "";
            if (type === 'row') desc = `Row ${index + 1}`;
            else if (type === 'col') desc = `Col ${index + 1}`;
            else if (type === 'diag-main') desc = `Main Diagonal`;
            else if (type === 'diag-anti') desc = `Anti-Diagonal`;
            addBingoToLog(desc);

            const line = document.createElement('div');
            line.className = 'win-line';
            line.dataset.lineId = lineId;
            const cells = document.querySelectorAll('.cell');
            const boardWidth = boardElement.offsetWidth;
            const boardHeight = boardElement.offsetHeight;
            const cellSize = cells[0].offsetWidth;
            const gap = window.innerWidth < 640 ? 6 : 8;
            const thickness = window.innerWidth < 640 ? 6 : 8;
            if (type === 'row') {
                const y = index * (cellSize + gap) + (cellSize / 2) - (thickness / 2);
                line.style.width = '100%'; line.style.top = y + 'px'; line.style.left = '0';
                line.style.setProperty('--rotation', '0deg');
            } else if (type === 'col') {
                const x = index * (cellSize + gap) + (cellSize / 2) - (thickness / 2);
                line.style.width = boardHeight + 'px';
                line.style.top = (boardHeight / 2 - thickness / 2) + 'px';
                line.style.left = (x - (boardHeight / 2) + (thickness / 2)) + 'px';
                line.style.setProperty('--rotation', '90deg');
            } else if (type === 'diag-main') {
                const length = Math.sqrt(Math.pow(boardWidth, 2) + Math.pow(boardHeight, 2));
                line.style.transformOrigin = '0 50%'; line.style.width = length + 'px';
                line.style.top = '0'; line.style.left = '0';
                const angle = Math.atan2(boardHeight, boardWidth) * (180 / Math.PI);
                line.style.setProperty('--rotation', `${angle}deg`);
            } else if (type === 'diag-anti') {
                const length = Math.sqrt(Math.pow(boardWidth, 2) + Math.pow(boardHeight, 2));
                line.style.transformOrigin = '100% 50%'; line.style.width = length + 'px';
                line.style.top = '0'; line.style.right = '0';
                const angle = Math.atan2(boardHeight, boardWidth) * (180 / Math.PI);
                line.style.setProperty('--rotation', `-${angle}deg`);
            }
            boardElement.appendChild(line);
            triggerConfetti(false);
        }

        function checkWin() {
            const cells = Array.from(document.querySelectorAll('.cell'));
            const marked = cells.map(c => c.classList.contains('marked'));
            
            if (marked.every(v => v) && !hasExplodedBoard) {
                triggerConfetti(true);
                hasExplodedBoard = true;
                clearTimeout(fallTimeout);
                fallTimeout = setTimeout(handleGravityFall, 1000);
            }
            
            let foundAnyBingo = false;
            for (let i = 0; i < 5; i++) {
                if (marked.slice(i*5, i*5+5).every(v => v)) { addWinLine('row', i); foundAnyBingo = true; }
                else removeLine('row', i);
                if ([0,1,2,3,4].every(row => marked[row*5 + i])) { addWinLine('col', i); foundAnyBingo = true; }
                else removeLine('col', i);
            }
            if ([0,6,12,18,24].every(idx => marked[idx])) { addWinLine('diag-main', 0); foundAnyBingo = true; }
            else removeLine('diag-main', 0);
            if ([4,8,12,16,20].every(idx => marked[idx])) { addWinLine('diag-anti', 0); foundAnyBingo = true; }
            else removeLine('diag-anti', 0);
            
            if (foundAnyBingo) {
                winMessage.classList.remove('hidden');
                if (!isBouncing) {
                    winMessage.classList.add('animate-bounce');
                    winMessage.style.bottom = '1.5rem';
                    winMessage.style.left = '50%'; winMessage.style.transform = 'translateX(-50%)';
                }
            } else if (!isBouncing) {
                winMessage.classList.add('hidden'); winMessage.classList.remove('animate-bounce');
            }
        }

        function removeLine(type, index) {
            const lineId = `${type}-${index}`;
            if (activeWinningLines.has(lineId)) {
                activeWinningLines.delete(lineId);
                const lineEl = boardElement.querySelector(`[data-line-id="${lineId}"]`);
                if (lineEl) lineEl.remove();
            }
        }