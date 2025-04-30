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

function updateEraserCursor() {
    const padding = 4; // dodatni prostor da ne "siječe" krug
    const size = currentEraserSize;
    const svgSize = size * 2 + padding;
    const center = size + padding / 2;

    const svgCursor = `
        <svg xmlns='http://www.w3.org/2000/svg' width='${svgSize}' height='${svgSize}'>
            <circle cx='${center}' cy='${center}' r='${size}' fill='white' stroke='black' stroke-width='2'/>
        </svg>
    `;

    const cursorData = `url("data:image/svg+xml;base64,${btoa(svgCursor)}") ${center} ${center}, auto`;

    const existing = document.getElementById("custom-cursor-style");
    if (existing) existing.remove();

    const style = document.createElement("style");
    style.id = "custom-cursor-style";
    style.textContent = `
        #drawing-canvas {
            cursor: ${cursorData} !important;
        }
        html, body {
            cursor: ${cursorData} !important;
        }
    `;
    document.head.appendChild(style);
}


function resetCursor() {
    const existing = document.getElementById("custom-cursor-style");
    if (existing) existing.remove();
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
    resizeCanvas();
    if (drawingHistory.length > 0) {
        const img = new Image();
        img.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = drawingHistory[historyIndex];
    }
}

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

function addImageToCanvas(img) {
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
    const imgWidth = Math.min(img.width, rect.width * 0.8);
    const imgHeight = (img.height / img.width) * imgWidth;
    
    imgContainer.style.width = `${imgWidth}px`;
    imgContainer.style.height = `${imgHeight}px`;
    imgContainer.style.left = `${(rect.width - imgWidth) / 2}px`;
    imgContainer.style.top = `${(rect.height - imgHeight) / 2}px`;

    selectedImage = {
        element: imgContainer,
        img: imgElement,
        resizeHandle: resizeHandle,
        x: (rect.width - imgWidth) / 2,
        y: (rect.height - imgHeight) / 2,
        width: imgWidth,
        height: imgHeight
    };

    setupImageInteractions(imgContainer, resizeHandle);
}

function setupImageInteractions(imgContainer, resizeHandle) {
    let isDragging = false;
    let isResizing = false;
    let startX, startY;
    let startWidth, startHeight;
    let startLeft, startTop;

    imgContainer.addEventListener('mousedown', function(e) {
        if (e.target === imgContainer || e.target === imgContainer.querySelector('img')) {
            document.querySelectorAll('.imported-image').forEach(el => {
                el.classList.remove('selected');
            });
            
            imgContainer.classList.add('selected');
            selectedImage = {
                element: imgContainer,
                img: imgContainer.querySelector('img'),
                resizeHandle: resizeHandle,
                x: parseInt(imgContainer.style.left),
                y: parseInt(imgContainer.style.top),
                width: parseInt(imgContainer.style.width),
                height: parseInt(imgContainer.style.height)
            };
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(imgContainer.style.left);
            startTop = parseInt(imgContainer.style.top);
            e.preventDefault();
        }
    });

    imgContainer.addEventListener('touchstart', function(e) {
        if (e.target === imgContainer || e.target === imgContainer.querySelector('img')) {
            document.querySelectorAll('.imported-image').forEach(el => {
                el.classList.remove('selected');
            });
            
            imgContainer.classList.add('selected');
            selectedImage = {
                element: imgContainer,
                img: imgContainer.querySelector('img'),
                resizeHandle: resizeHandle,
                x: parseInt(imgContainer.style.left),
                y: parseInt(imgContainer.style.top),
                width: parseInt(imgContainer.style.width),
                height: parseInt(imgContainer.style.height)
            };
            
            isDragging = true;
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            startLeft = parseInt(imgContainer.style.left);
            startTop = parseInt(imgContainer.style.top);
            e.preventDefault();
        }
    });

    resizeHandle.addEventListener('mousedown', function(e) {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(imgContainer.style.width);
        startHeight = parseInt(imgContainer.style.height);
        e.stopPropagation();
    });

    resizeHandle.addEventListener('touchstart', function(e) {
        isResizing = true;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startWidth = parseInt(imgContainer.style.width);
        startHeight = parseInt(imgContainer.style.height);
        e.stopPropagation();
        e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
        if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            imgContainer.style.left = `${startLeft + dx}px`;
            imgContainer.style.top = `${startTop + dy}px`;
            
            if (selectedImage && selectedImage.element === imgContainer) {
                selectedImage.x = startLeft + dx;
                selectedImage.y = startTop + dy;
            }
        } else if (isResizing) {
            const dx = e.clientX - startX;
            const newWidth = Math.max(50, startWidth + dx);
            const newHeight = (startHeight / startWidth) * newWidth;
            
            imgContainer.style.width = `${newWidth}px`;
            imgContainer.style.height = `${newHeight}px`;
            
            if (selectedImage && selectedImage.element === imgContainer) {
                selectedImage.width = newWidth;
                selectedImage.height = newHeight;
            }
        }
    });

    document.addEventListener('touchmove', function(e) {
        if (isDragging) {
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
        } else if (isResizing) {
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
    });

    document.addEventListener('mouseup', function() {
        isDragging = false;
        isResizing = false;
    });

    document.addEventListener('touchend', function() {
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

function saveState() {
    if (historyIndex < drawingHistory.length - 1) {
        drawingHistory.length = historyIndex + 1;
    }
    drawingHistory.push(canvas.toDataURL());
    historyIndex++;
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        const img = new Image();
        img.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = drawingHistory[historyIndex];
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        historyIndex = -1;
    }
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

pencilBtn.addEventListener('click', () => {
    currentTool = 'pencil';
    pencilBtn.classList.add('active');
    eraserBtn.classList.remove('active');
    textBtn.classList.remove('active');
    canvas.style.cursor = 'crosshair';
    eraserSizeControl.classList.remove('show');
    resetCursor();
    if (isTextModeActive) {
        addText();
    }
});

eraserBtn.addEventListener('click', () => {
    currentTool = 'eraser';
    eraserBtn.classList.add('active');
    pencilBtn.classList.remove('active');
    textBtn.classList.remove('active');
    toggleEraserSizeControl();
    updateEraserCursor();
    if (isTextModeActive) {
        addText();
    }
});

textBtn.addEventListener('click', () => {
    currentTool = 'text';
    textBtn.classList.add('active');
    pencilBtn.classList.remove('active');
    eraserBtn.classList.remove('active');
    canvas.style.cursor = 'text';
    eraserSizeControl.classList.remove('show');
    resetCursor();
});

undoBtn.addEventListener('click', undo);

exportBtn.addEventListener('click', exportCanvas);
importBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleImageUpload);

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