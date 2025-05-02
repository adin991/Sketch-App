const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const pencilBtn = document.getElementById('pencil-btn');
const eraserBtn = document.getElementById('eraser-btn');
const textBtn = document.getElementById('text-btn');
const undoBtn = document.getElementById('undo-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const fileInput = document.getElementById('file-input');
const drawingArea = document.getElementById('drawing-area');
const textInputContainer = document.getElementById('text-input-container');
const textInput = document.getElementById('text-input');
const colorPalette = document.getElementById('color-palette');
const colorOptions = document.querySelectorAll('.color-option');
const eraserSizeControl = document.getElementById('eraser-size-control');
const sizeOptions = document.querySelectorAll('.size-option');

let isDrawing = false;
let currentTool = 'pencil';
let currentColor = '#000000';
let lastX = 0;
let lastY = 0;
const drawingHistory = [];
let historyIndex = -1;
let textPosition = { x: 0, y: 0 };
let isTextModeActive = false;
let selectedImage = null;
let isDragging = false;
let isResizingImage = false;
let dragStartX, dragStartY;
let imageStartX, imageStartY, imageStartWidth, imageStartHeight;
let currentEraserSize = 20;

// Postavi početnu veličinu gumice
sizeOptions[0].classList.add('active');

// Funkcije za kontrolu veličine gumice
function toggleEraserSizeControl() {
    if (currentTool === 'eraser') {
        eraserSizeControl.classList.add('show');
    } else {
        eraserSizeControl.classList.remove('show');
    }
}

function updateImages(targetImages) {
    const currentImages = Array.from(document.querySelectorAll('.imported-image'));
    
    // Ukloni slike koje više ne postoje u novom stanju
    currentImages.forEach(imgContainer => {
        const imgSrc = imgContainer.querySelector('img').src;
        if (!targetImages.some(img => img.src === imgSrc)) {
            imgContainer.remove();
        }
    });
    
    // Ažuriraj postojeće ili dodaj nove slike
    targetImages.forEach(imgData => {
        let imgContainer = document.querySelector(`.imported-image img[src="${imgData.src}"]`)?.parentElement;
        
        if (imgContainer) {
            // Ažuriraj postojeću sliku
            imgContainer.style.left = `${imgData.x}px`;
            imgContainer.style.top = `${imgData.y}px`;
            imgContainer.style.width = `${imgData.width}px`;
            imgContainer.style.height = `${imgData.height}px`;
        } else {
            // Dodaj novu sliku
            const img = new Image();
            img.onload = () => {
                const newContainer = createImageContainer(img, imgData);
                drawingArea.appendChild(newContainer);
            };
            img.src = imgData.src;
        }
    });
}

function createImageContainer(img, imgData) {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'imported-image';
    imgContainer.style.position = 'absolute';
    imgContainer.style.left = `${imgData.x}px`;
    imgContainer.style.top = `${imgData.y}px`;
    imgContainer.style.width = `${imgData.width}px`;
    imgContainer.style.height = `${imgData.height}px`;
    
    const imgElement = document.createElement('img');
    imgElement.src = imgData.src;
    imgElement.style.maxWidth = '100%';
    imgElement.style.maxHeight = '100%';
    
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'image-resize-handle';
    
    imgContainer.appendChild(imgElement);
    imgContainer.appendChild(resizeHandle);
    
    setupImageInteractions(imgContainer, resizeHandle);
    return imgContainer;
}

function resetCursor() {
    const existing = document.getElementById("custom-cursor-style");
    if (existing) existing.remove();
    
    // Uklonite klasu za aktivnu gumicu
    canvas.classList.remove('eraser-active');
}

// Event listeneri za veličinu gumice
sizeOptions.forEach(option => {
    option.addEventListener('click', function() {
        sizeOptions.forEach(opt => opt.classList.remove('active'));
        this.classList.add('active');
        currentEraserSize = parseInt(this.dataset.size);
        updateEraserCursor();
    });
});

function updateEraserCursor() {
    // Prvo uklonite postojeći custom kursor
    resetCursor();
    
    const padding = 4;
    const size = currentEraserSize;
    const svgSize = size * 2 + padding;
    const center = size + padding / 2;

    const svgCursor = `
        <svg xmlns='http://www.w3.org/2000/svg' width='${svgSize}' height='${svgSize}'>
            <circle cx='${center}' cy='${center}' r='${size}' fill='white' stroke='black' stroke-width='2'/>
        </svg>
    `;

    const cursorData = `url("data:image/svg+xml;base64,${btoa(svgCursor)}") ${center} ${center}, auto`;

    const style = document.createElement("style");
    style.id = "custom-cursor-style";
    style.textContent = `
        #drawing-canvas.eraser-active {
            cursor: ${cursorData} !important;
        }
    `;
    document.head.appendChild(style);
    
    // Dodajte klasu za aktivnu gumicu
    canvas.classList.add('eraser-active');
}

function getTouchPos(canvas, touchEvent) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: touchEvent.touches[0].clientX - rect.left,
        y: touchEvent.touches[0].clientY - rect.top
    };
}

function selectColor(e) {
    colorOptions.forEach(option => {
        option.classList.remove('selected');
    });
    
    e.target.classList.add('selected');
    currentColor = e.target.dataset.color;
}

const newBoardBtn = document.getElementById('new-board-btn');

newBoardBtn.addEventListener('click', () => {
    const confirmNewBoard = confirm("Do you want a new Board?");
    
    if (confirmNewBoard) {
        location.reload();
    }
});

function resizeCanvas() {
    const rect = drawingArea.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.textBaseline = 'top';
    ctx.font = '16px Arial';
    
    saveState();
}

function handleResize() {
    // Sačuvaj trenutni sadržaj canvas-a u privremeni canvas
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCtx.drawImage(canvas, 0, 0);
    
    // Sačuvaj pozicije i veličine uvezenih slika
    const savedImages = [];
    document.querySelectorAll('.imported-image').forEach(imgContainer => {
        savedImages.push({
            element: imgContainer,
            x: parseInt(imgContainer.style.left),
            y: parseInt(imgContainer.style.top),
            width: parseInt(imgContainer.style.width),
            height: parseInt(imgContainer.style.height)
        });
    });
    
    // Resizeaj glavni canvas
    const rect = drawingArea.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Vrati sadržaj na novi canvas
    ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvas.width, canvas.height);
    
    // Ponovo postavi uvezene slike sa novim pozicijama
    savedImages.forEach(imgData => {
        const ratioX = canvas.width / tempCanvas.width;
        const ratioY = canvas.height / tempCanvas.height;
        
        imgData.element.style.left = `${imgData.x * ratioX}px`;
        imgData.element.style.top = `${imgData.y * ratioY}px`;
        imgData.element.style.width = `${imgData.width * ratioX}px`;
        imgData.element.style.height = `${imgData.height * ratioY}px`;
    });
    
    // Ažuriraj drawing history
    if (drawingHistory.length > 0) {
        const img = new Image();
        img.onload = function() {
            ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height);
        };
        img.src = drawingHistory[historyIndex];
    }
}

window.addEventListener('beforeunload', function() {
    // Ovo će osigurati da se stranica potpuno resetuje
    // Ako želite da se sadržaj sačuva između reloadova, morate koristiti localStorage
});

window.addEventListener('load', handleResize);
window.addEventListener('resize', handleResize);

function startDrawing(e) {
    if (e.touches) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            touches: e.touches
        };
        e = mouseEvent;
    }

    if (selectedImage && currentTool !== 'text') {
        deselectImage();
    }
    
    if (currentTool === 'pencil' || currentTool === 'eraser') {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        lastX = e.clientX - rect.left;
        lastY = e.clientY - rect.top;
        
        if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
        }
    } else if (currentTool === 'text') {
        if (!isTextModeActive) {
            const rect = canvas.getBoundingClientRect();
            textPosition = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            
            textInputContainer.style.display = 'block';
            textInputContainer.style.left = `${textPosition.x}px`;
            textInputContainer.style.top = `${textPosition.y}px`;
            textInput.value = '';
            textInput.focus();
            isTextModeActive = true;
        }
    }
}

function stopDrawing() {
    if (isDrawing) {
        saveState();
    }
    isDrawing = false;
}

function draw(e) {
    if (!isDrawing || currentTool === 'text') return;

    if (e.touches) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY
        };
        e = mouseEvent;
    }

    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    if (currentTool === 'pencil') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 3;
    } else if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = currentEraserSize;
    }

    ctx.lineTo(currentX, currentY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(currentX, currentY);
}

function addText() {
    const text = textInput.value;
    if (text) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = '16px Arial';
        ctx.fillStyle = currentColor;
        ctx.textBaseline = 'top';
        
        const lines = text.split('\n');
        let y = parseInt(textInputContainer.style.top);
        
        for (const line of lines) {
            ctx.fillText(line, parseInt(textInputContainer.style.left), y);
            y += 20;
        }
        
        saveState();
    }
    textInputContainer.style.display = 'none';
    isTextModeActive = false;
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            addImageToCanvas(img);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// Zamijenite postojeću addImageToCanvas funkciju sa ovom:
function addImageToCanvas(img, x, y, width, height) {
    // Obriši selektovanu sliku ako postoji
    if (selectedImage) {
        selectedImage.element.remove();
    }

    const imgContainer = document.createElement('div');
    imgContainer.className = 'imported-image selected';
    
    const imgElement = document.createElement('img');
    imgElement.src = img.src;
    imgElement.style.maxWidth = '100%';
    imgElement.style.maxHeight = '100%';
    
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'image-resize-handle';
    
    imgContainer.appendChild(imgElement);
    imgContainer.appendChild(resizeHandle);
    drawingArea.appendChild(imgContainer);

    const rect = drawingArea.getBoundingClientRect();
    imgContainer.style.width = `${width || Math.min(img.width, rect.width * 0.8)}px`;
    imgContainer.style.height = `${height || (img.height / img.width) * (width || Math.min(img.width, rect.width * 0.8))}px`;
    imgContainer.style.left = `${x || (rect.width - (width || Math.min(img.width, rect.width * 0.8))) / 2}px`;
    imgContainer.style.top = `${y || (rect.height - (height || (img.height / img.width) * (width || Math.min(img.width, rect.width * 0.8)))) / 2}px`;

    selectedImage = {
        element: imgContainer,
        img: imgElement,
        resizeHandle: resizeHandle,
        x: parseInt(imgContainer.style.left),
        y: parseInt(imgContainer.style.top),
        width: parseInt(imgContainer.style.width),
        height: parseInt(imgContainer.style.height)
    };

    setupImageInteractions(imgContainer, resizeHandle);
    
    // Snimi novo stanje
    saveState();
}

function setupImageInteractions(imgContainer, resizeHandle) {
    let isDragging = false;
    let isResizing = false;
    let isPinching = false;
    let startDistance = 0;
    let startWidth = 0, startHeight = 0;
    let startX, startY;
    let startLeft, startTop;

    // Mouse events
    imgContainer.addEventListener('mousedown', function(e) {
        if (e.target === resizeHandle) {
            // Resize sa mišem
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(imgContainer.style.width);
            startHeight = parseInt(imgContainer.style.height);
            e.stopPropagation();
        } else if (e.target === imgContainer || e.target === imgContainer.querySelector('img')) {
            // Drag sa mišem
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(imgContainer.style.left);
            startTop = parseInt(imgContainer.style.top);
            e.preventDefault();
        }
    });

    // Touch events (ostaje isti kao prije)
    imgContainer.addEventListener('touchstart', function(e) {
        if (e.touches.length === 2) {
            isPinching = true;
            isDragging = false;
            isResizing = false;
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            startDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
            startWidth = parseInt(imgContainer.style.width);
            startHeight = parseInt(imgContainer.style.height);
            e.preventDefault();
        } else if (e.touches.length === 1) {
            const touch = e.touches[0];
            if (e.target === resizeHandle) {
                isResizing = true;
                startX = touch.clientX;
                startY = touch.clientY;
                startWidth = parseInt(imgContainer.style.width);
                startHeight = parseInt(imgContainer.style.height);
            } else {
                isDragging = true;
                startX = touch.clientX;
                startY = touch.clientY;
                startLeft = parseInt(imgContainer.style.left);
                startTop = parseInt(imgContainer.style.top);
            }
            e.preventDefault();
        }
    });

    // Mouse move handler
    document.addEventListener('mousemove', function(e) {
        if (isResizing) {
            const dx = e.clientX - startX;
            const newWidth = Math.max(50, startWidth + dx);
            const newHeight = (startHeight / startWidth) * newWidth;
            
            imgContainer.style.width = `${newWidth}px`;
            imgContainer.style.height = `${newHeight}px`;
            
            if (selectedImage && selectedImage.element === imgContainer) {
                selectedImage.width = newWidth;
                selectedImage.height = newHeight;
            }
        } else if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            imgContainer.style.left = `${startLeft + dx}px`;
            imgContainer.style.top = `${startTop + dy}px`;
            
            if (selectedImage && selectedImage.element === imgContainer) {
                selectedImage.x = startLeft + dx;
                selectedImage.y = startTop + dy;
            }
        }
    });

    // Touch move handler (ostaje isti kao prije)
    document.addEventListener('touchmove', function(e) {
        if (isPinching && e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
            
            if (startDistance > 0) {
                const scale = currentDistance / startDistance;
                const newWidth = startWidth * scale;
                const newHeight = startHeight * scale;
                
                const minSize = 50;
                const maxSize = Math.max(canvas.width, canvas.height) * 1.5;
                
                if (newWidth >= minSize && newWidth <= maxSize) {
                    imgContainer.style.width = `${newWidth}px`;
                    imgContainer.style.height = `${newHeight}px`;
                    
                    if (selectedImage && selectedImage.element === imgContainer) {
                        selectedImage.width = newWidth;
                        selectedImage.height = newHeight;
                    }
                }
            }
            e.preventDefault();
        } else if (isDragging && e.touches.length === 1) {
            const touch = e.touches[0];
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            
            imgContainer.style.left = `${startLeft + dx}px`;
            imgContainer.style.top = `${startTop + dy}px`;
            
            if (selectedImage && selectedImage.element === imgContainer) {
                selectedImage.x = startLeft + dx;
                selectedImage.y = startTop + dy;
            }
            e.preventDefault();
        } else if (isResizing && e.touches.length === 1) {
            const touch = e.touches[0];
            const dx = touch.clientX - startX;
            const newWidth = Math.max(50, startWidth + dx);
            const newHeight = (startHeight / startWidth) * newWidth;
            
            imgContainer.style.width = `${newWidth}px`;
            imgContainer.style.height = `${newHeight}px`;
            
            if (selectedImage && selectedImage.element === imgContainer) {
                selectedImage.width = newWidth;
                selectedImage.height = newHeight;
            }
            e.preventDefault();
        }
    }, { passive: false });

    // Mouse up handler
    document.addEventListener('mouseup', function() {
        if (isDragging || isResizing) {
            saveState();
        }
        isDragging = false;
        isResizing = false;
    });

    // Touch end handler
    document.addEventListener('touchend', function() {
        if (isPinching || isDragging || isResizing) {
            saveState();
        }
        isPinching = false;
        isDragging = false;
        isResizing = false;
    });
}

function deselectImage() {
            if (selectedImage) {
                selectedImage.element.classList.remove('selected');
                selectedImage.resizeHandle.style.display = 'none';
                selectedImage = null;
            }
        }

function exportCanvas() {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    const rect = drawingArea.getBoundingClientRect();
    
    tempCanvas.width = rect.width;
    tempCanvas.height = rect.height;
    
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    document.querySelectorAll('.imported-image').forEach(imgContainer => {
        const img = imgContainer.querySelector('img');
        const left = parseInt(imgContainer.style.left);
        const top = parseInt(imgContainer.style.top);
        const width = parseInt(imgContainer.style.width);
        const height = parseInt(imgContainer.style.height);
        
        tempCtx.drawImage(img, left, top, width, height);
    });
    
    tempCtx.drawImage(canvas, 0, 0);
    
    const dataURL = tempCanvas.toDataURL('image/png');
    
    const popup = document.getElementById("export-success");
    const previewImg = document.getElementById("exported-preview");
    previewImg.src = dataURL;
    
    popup.classList.remove("hide");
    popup.classList.add("show");
    
    const link = document.createElement('a');
    link.download = 'drawing-' + new Date().toISOString().slice(0, 10) + '.png';
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Zamijenite postojeću saveState funkciju sa ovom:
function saveState() {
    // Ako nismo na kraju historije, obriši sve nakon trenutnog indeksa
    if (historyIndex < drawingHistory.length - 1) {
        drawingHistory.length = historyIndex + 1;
    }
    
    // Snimi trenutni sadržaj canvas-a
    const canvasData = canvas.toDataURL();
    
    // Prikupi sve uvezene slike
    const images = Array.from(document.querySelectorAll('.imported-image')).map(imgContainer => {
        return {
            src: imgContainer.querySelector('img').src,
            x: parseInt(imgContainer.style.left),
            y: parseInt(imgContainer.style.top),
            width: parseInt(imgContainer.style.width),
            height: parseInt(imgContainer.style.height)
        };
    });
    
    // Dodaj novo stanje u historiju
    drawingHistory.push({ canvasData, images });
    historyIndex++;
    
    // Ograniči veličinu historije (npr. zadnjih 50 koraka)
    if (drawingHistory.length > 50) {
        drawingHistory.shift();
        historyIndex--;
    }
}

function undo() {
    if (historyIndex > 0) {
        // Koristimo requestAnimationFrame za glatku animaciju
        requestAnimationFrame(() => {
            historyIndex--;
            const state = drawingHistory[historyIndex];
            
            // Optimizovano ažuriranje - prvo canvas
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                
                // Ažuriranje slika bez potpunog brisanja
                updateImages(state.images);
            };
            img.src = state.canvasData;
        });
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        clearAllImages();
        historyIndex = -1;
    }
}

function restoreState(index) {
    const state = drawingHistory[index];
    
    // Očisti canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Očisti sve slike
    clearAllImages();
    
    // Vrati sadržaj canvas-a
    const img = new Image();
    img.onload = function() {
        ctx.drawImage(img, 0, 0);
    };
    img.src = state.canvasData;
    
    // Vrati sve slike iz tog stanja
    state.images.forEach(imgData => {
        const img = new Image();
        img.onload = function() {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'imported-image';
            imgContainer.style.position = 'absolute';
            imgContainer.style.left = `${imgData.x}px`;
            imgContainer.style.top = `${imgData.y}px`;
            imgContainer.style.width = `${imgData.width}px`;
            imgContainer.style.height = `${imgData.height}px`;
            
            const imgElement = document.createElement('img');
            imgElement.src = imgData.src;
            imgElement.style.maxWidth = '100%';
            imgElement.style.maxHeight = '100%';
            
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'image-resize-handle';
            
            imgContainer.appendChild(imgElement);
            imgContainer.appendChild(resizeHandle);
            drawingArea.appendChild(imgContainer);
            
            setupImageInteractions(imgContainer, resizeHandle);
        };
        img.src = imgData.src;
    });
}

function clearAllImages() {
    document.querySelectorAll('.imported-image').forEach(el => el.remove());
    selectedImage = null;
}

// Event listeners
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        touches: e.touches
    });
    startDrawing(mouseEvent);
}, false);

canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        touches: e.touches
    });
    draw(mouseEvent);
}, false);

canvas.addEventListener('touchend', function(e) {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    stopDrawing(mouseEvent);
}, false);

drawingArea.addEventListener('mousedown', function(e) {
    if (e.target === drawingArea) {
        deselectImage();
    }
});

drawingArea.addEventListener('touchstart', function(e) {
    if (e.target === drawingArea) {
        deselectImage();
        e.preventDefault();
    }
}, false);

textInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addText();
    }
});

colorOptions.forEach(option => {
    option.addEventListener('click', selectColor);
    option.addEventListener('touchstart', selectColor);
});

// Olovka
pencilBtn.addEventListener('click', () => {
    currentTool = 'pencil';
    pencilBtn.classList.add('active');
    eraserBtn.classList.remove('active');
    textBtn.classList.remove('active');
    canvas.style.cursor = 'crosshair';
    eraserSizeControl.classList.remove('show');
    resetCursor(); // Eksplicitno resetujemo custom kursor
});

// Gumica
eraserBtn.addEventListener('click', () => {
    currentTool = 'eraser';
    eraserBtn.classList.add('active');
    pencilBtn.classList.remove('active');
    textBtn.classList.remove('active');
    toggleEraserSizeControl();
    updateEraserCursor(); // Eksplicitno postavljamo kursor za gumicu
    if (isTextModeActive) {
        addText();
    }
});

// Tekst
textBtn.addEventListener('click', () => {
    currentTool = 'text';
    textBtn.classList.add('active');
    pencilBtn.classList.remove('active');
    eraserBtn.classList.remove('active');
    canvas.style.cursor = 'text';
    eraserSizeControl.classList.remove('show');
    resetCursor(); // Eksplicitno resetujemo custom kursor
    if (isTextModeActive) {
        addText();
    }
});
undoBtn.addEventListener('click', undo);

exportBtn.addEventListener('click', exportCanvas);
importBtn.addEventListener('click', () => fileInput.click());
// Ažurirajte event listenere za dodavanje slika
fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            addImageToCanvas(img);
            fileInput.value = ''; // Reset file input
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

const popup = document.getElementById("export-success");
const closeBtn = document.querySelector(".close-btn");

function hidePopup() {
    popup.classList.remove("show");
    popup.classList.add("hide");

    setTimeout(() => {
        popup.style.display = "none";
    }, 300);
}

closeBtn.addEventListener("click", hidePopup);

window.addEventListener("click", (e) => {
    if (e.target === popup) {
        hidePopup();
    }
});

const observer = new MutationObserver(() => {
    if (popup.classList.contains("show")) {
        popup.style.display = "flex";
    }
});

observer.observe(popup, { attributes: true, attributeFilter: ['class'] });

document.addEventListener('click', (e) => {
    const popup = document.getElementById("export-success");
    if (e.target === popup) {
        popup.classList.remove("show");
        popup.classList.add("hide");
    }
});

// Initial setup
resizeCanvas();

drawingHistory.push({
    canvasData: canvas.toDataURL(),
    images: []
});
historyIndex = 0;