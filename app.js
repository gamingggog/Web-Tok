const { useState, useEffect, useRef } = React;

const room = new WebsimSocket();

// Upload Modal Component - Handles video upload with caption and hashtags
function UploadModal({ onClose }) {
  // State management for form fields and upload status
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [hashtag, setHashtag] = useState('');
  const [hashtags, setHashtags] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // Handle file selection from device
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  // Add new hashtag to the list
  const handleAddHashtag = (e) => {
    e.preventDefault();
    if (hashtag.trim() && !hashtags.includes(hashtag.trim())) {
      setHashtags([...hashtags, hashtag.trim()]);
      setHashtag('');
    }
  };

  // Remove hashtag from the list
  const handleRemoveHashtag = (tagToRemove) => {
    setHashtags(hashtags.filter(tag => tag !== tagToRemove));
  };

  // Handle form submission and video upload
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || isUploading) return;

    try {
      setIsUploading(true);
      const url = await websim.upload(file);
      await room.collection('video_post').create({
        videoUrl: url,
        caption: caption,
        hashtags: hashtags
      });
      onClose();
    } catch (error) {
      console.error('Error uploading video:', error);
      alert('Failed to upload video. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="upload-modal" onClick={onClose}>
      <div className="upload-form" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Upload Video</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Select Video</label>
            <input 
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="form-input"
            />
            {file && (
              <div className="selected-file">
                Selected: {file.name}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Caption</label>
            <input
              type="text"
              className="form-input"
              placeholder="Write a caption..."
              value={caption}
              onChange={e => setCaption(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Hashtags</label>
            <form onSubmit={handleAddHashtag}>
              <input
                type="text"
                className="form-input"
                placeholder="Add hashtags..."
                value={hashtag}
                onChange={e => setHashtag(e.target.value)}
              />
            </form>
            <div className="hashtag-list">
              {hashtags.map(tag => (
                <span key={tag} className="hashtag">
                  #{tag}
                  <button 
                    className="remove-hashtag"
                    onClick={() => handleRemoveHashtag(tag)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <button 
            className="submit-btn" 
            disabled={!file || isUploading}
          >
            {isUploading ? 'Uploading...' : 'Post'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Comment Modal Component
function CommentModal({ post, onClose }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  // Subscribe to comments for this post
  React.useEffect(() => {
    const unsubscribe = room.collection('comment')
      .filter({ post_id: post.id })
      .subscribe(setComments);
    return () => unsubscribe();
  }, [post.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await room.collection('comment').create({
        post_id: post.id,
        text: newComment.trim()
      });
      setNewComment('');
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment. Please try again.');
    }
  };

  return (
    <div className="comment-modal" onClick={onClose}>
      <div className="comment-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Comments</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="comments-list">
          {comments.length === 0 ? (
            <div className="no-comments">No comments yet. Be the first!</div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="comment">
                <img 
                  className="comment-avatar"
                  src={`https://images.websim.ai/avatar/${comment.username}`}
                  alt={comment.username}
                />
                <div className="comment-content">
                  <div className="comment-username">@{comment.username}</div>
                  <div className="comment-text">{comment.text}</div>
                  <div className="comment-time">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <form className="comment-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="comment-input"
            placeholder="Add a comment..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            maxLength={200}
          />
          <button 
            className="comment-submit"
            disabled={!newComment.trim()}
          >
            Post
          </button>
        </form>
      </div>
    </div>
  );
}

// Main App Component - Manages the video feed and upload modal
function App() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  
  // Subscribe to video posts collection
  const posts = React.useSyncExternalStore(
    room.collection('video_post').subscribe,
    room.collection('video_post').getList
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp' && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (e.key === 'ArrowDown' && currentIndex < posts.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, posts.length]);

  // Handle mouse wheel scrolling
  useEffect(() => {
    const handleWheel = (e) => {
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set a new timeout to prevent rapid scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        if (e.deltaY > 0 && currentIndex < posts.length - 1) {
          setCurrentIndex(currentIndex + 1);
        } else if (e.deltaY < 0 && currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        }
      }, 50); // Debounce time
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [currentIndex, posts.length]);

  // Touch handlers for swipe navigation
  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (!touchStart) return;

    const deltaY = e.touches[0].clientY - touchStart;
    // If swipe distance is more than 50px, change video
    if (Math.abs(deltaY) > 50) {
      if (deltaY < 0 && currentIndex < posts.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (deltaY > 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
      setTouchStart(null);
    }
  };

  const handleTouchEnd = () => {
    setTouchStart(null);
  };

  // Add scroll indicator for desktop users
  const showScrollIndicator = currentIndex < posts.length - 1;

  return (
    <div className="app">
      <div 
        className="feed"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          className="video-container" 
          ref={containerRef}
          style={{
            transform: `translateY(-${currentIndex * 100}%)`
          }}
        >
          {posts.map((post, index) => (
            <VideoCard 
              key={post.id} 
              post={post}
              active={index === currentIndex}
            />
          ))}
        </div>

        {/* Scroll indicator */}
        {showScrollIndicator && (
          <div className="scroll-indicator">
            <div className="scroll-indicator-icon">↓</div>
            <div className="scroll-indicator-text">Scroll for more</div>
          </div>
        )}
      </div>
      
      <button 
        className="upload-btn"
        onClick={() => setShowUploadModal(true)}
      >
        +
      </button>

      {showUploadModal && (
        <UploadModal onClose={() => setShowUploadModal(false)} />
      )}
    </div>
  );
}

// VideoCard Component - Individual video player with controls and interactions
function VideoCard({ post, active }) {
  const videoRef = useRef(null);
  const [likes, setLikes] = useState([]);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);

  // Subscribe to likes collection for this post
  React.useEffect(() => {
    const unsubscribe = room.collection('like')
      .filter({ post_id: post.id })
      .subscribe(setLikes);
    return () => unsubscribe();
  }, [post.id]);

  // Subscribe to comments count
  React.useEffect(() => {
    const unsubscribe = room.collection('comment')
      .filter({ post_id: post.id })
      .subscribe(setComments);
    return () => unsubscribe();
  }, [post.id]);

  // Control video playback when active status changes
  useEffect(() => {
    if (active && videoRef.current) {
      if (!isPaused) {
        videoRef.current.play().catch(console.error);
      }
    } else if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [active, isPaused]);

  // Toggle video play/pause on click
  const handleVideoClick = () => {
    if (!videoRef.current) return;
    
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPaused(false);
    } else {
      videoRef.current.pause();
      setIsPaused(true);
    }
  };

  // Handle like/unlike functionality
  const handleLike = async () => {
    const existingLike = likes.find(like => 
      like.username === room.party.client.username
    );

    if (existingLike) {
      await room.collection('like').delete(existingLike.id);
    } else {
      await room.collection('like').create({
        post_id: post.id
      });
    }
  };

  // Track when video is loaded to show/hide loading spinner
  const handleVideoLoad = () => {
    setIsVideoLoaded(true);
  };

  // Check if current user has liked the post
  const isLiked = likes.some(like => 
    like.username === room.party.client.username
  );

  return (
    <div className="video-card">
      <div className="video-content" onClick={handleVideoClick}>
        {!isVideoLoaded && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}>
            <div className="loading-spinner" />
          </div>
        )}
        <video 
          ref={videoRef}
          src={post.videoUrl}
          loop
          playsInline
          onLoadedData={handleVideoLoad}
          style={{ 
            opacity: isVideoLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }}
        />
        
        {isPaused && active && (
          <div className="pause-indicator">
            <div className="play-icon">▶</div>
          </div>
        )}
        
        <div className="video-overlay">
          <div className="user-info">
            <img 
              className="avatar"
              src={`https://images.websim.ai/avatar/${post.username}`}
              alt={post.username}
              loading="lazy"
            />
            <span className="username">@{post.username}</span>
          </div>
          
          <p className="caption">
            {post.caption}
            {post.hashtags && post.hashtags.map(tag => (
              <span key={tag} style={{
                color: '#fe2c55',
                marginLeft: '6px',
                fontWeight: '600'
              }}> #{tag}</span>
            ))}
          </p>
          
          <div className="actions">
            <button 
              className="action" 
              onClick={handleLike}
              style={{
                transform: isLiked ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.2s ease'
              }}
            >
              <span className="action-icon" style={{
                color: isLiked ? '#fe2c55' : 'white',
                transition: 'color 0.2s ease'
              }}>
                ♥
              </span>
              <span className="action-count">{likes.length}</span>
            </button>

            <button 
              className="action"
              onClick={(e) => {
                e.stopPropagation();
                setShowComments(true);
              }}
            >
              <span className="action-icon">💬</span>
              <span className="action-count">{comments.length}</span>
            </button>
          </div>
        </div>
      </div>

      {showComments && (
        <CommentModal 
          post={post}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
