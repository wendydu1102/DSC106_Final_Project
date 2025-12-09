// Video Modal Logic
const videoModal = document.getElementById('video-modal');
const videoIframe = document.getElementById('video-iframe');
// YouTube Embed URL
const videoSrc = "https://www.youtube.com/embed/RBYBbL1lqQk?autoplay=1&rel=0";

function openVideoModal() {
    videoModal.classList.add('active');
    // Inject src only when opening to enable autoplay and prevent background loading
    videoIframe.src = videoSrc;
}

function closeVideoModal(e) {
    // Close if clicked on overlay or close button, NOT content
    if (e.target.classList.contains('video-modal-overlay') || e.target.classList.contains('modal-close-btn') || e.target.classList.contains('video-modal-content')) {
        // Note: Click on content usually shouldn't close, but e.target check handles bubbling
    }

    // Explicit close logic needs to check if we actually want to close
    if (e.target.classList.contains('video-modal-overlay') || e.target.classList.contains('modal-close-btn')) {
        videoModal.classList.remove('active');
        // Clear src to stop video audio
        videoIframe.src = "";
    }
}
