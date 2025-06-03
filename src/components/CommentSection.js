import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import expertsService from '../services/expertsService';
import './CommentSection.css';
import { formatDistanceToNow } from 'date-fns';

// Default avatar for users without profile pictures
const DEFAULT_AVATAR = "https://t4.ftcdn.net/jpg/00/64/67/63/360_F_64676383_LdbmhiNM6Ypzb3FM4PPuFP9rHe7ri8Ju.jpg";

const CommentSection = ({ expertId, currentUser }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const navigate = useNavigate();

  useEffect(() => {
    fetchComments();
  }, [expertId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const commentsData = await expertsService.getExpertComments(expertId);
      setComments(commentsData);
      setError('');
    } catch (error) {
      setError('Failed to load comments');
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvatarColor = (username) => {
    if (!username) return '#0ca789'; // Default color if no username
    
    const colors = [
      '#4E3580', '#C8DA2B', '#0ca789', '#1976d2', '#f44336', 
      '#ff9800', '#9c27b0', '#3f51b5', '#009688', '#cddc39'
    ];
    const hash = username.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .toString()
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserDisplayName = (user) => {
    if (!user) return 'Anonymous';
    return user.displayName || (user.email ? user.email.split('@')[0] : 'Anonymous');
  };

  const handlePostComment = () => {
    if (!newComment.trim()) return;
    if (!currentUser) {
      setShowLoginPrompt(true);
      setMessage({ text: 'Please log in to post comments', type: 'error' });
      setTimeout(() => {
        setMessage({ text: '', type: '' });
      }, 3000);
      return;
    }

    setIsPosting(true);
    const userName = getUserDisplayName(currentUser);
    const newCommentObj = {
      id: Date.now(),
      userName: userName,
      text: newComment,
      timestamp: new Date(),
      likes: 0,
      liked: false,
      replies: []
    };

    // Animate new comment
    setTimeout(() => {
      setComments(prev => [newCommentObj, ...prev]);
      setNewComment('');
      setIsPosting(false);
      setMessage({ text: 'Comment added successfully', type: 'success' });
      setTimeout(() => {
        setMessage({ text: '', type: '' });
      }, 3000);
    }, 300);
  };

  const handlePostReply = (commentId) => {
    if (!replyText.trim()) return;
    if (!currentUser) {
      setShowLoginPrompt(true);
      setMessage({ text: 'Please log in to reply', type: 'error' });
      setTimeout(() => {
        setMessage({ text: '', type: '' });
      }, 3000);
      return;
    }

    const newReply = {
      id: Date.now(),
      author: currentUser.displayName || currentUser.email.split('@')[0],
      text: replyText,
      date: new Date(),
      likes: 0,
      liked: false
    };

    setComments(prev => prev.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          replies: [...(comment.replies || []), newReply]
        };
      }
      return comment;
    }));

    setReplyingTo(null);
    setReplyText('');
  };

  const toggleLike = (commentId, isReply = false, parentId = null) => {
    if (!currentUser) {
      setShowLoginPrompt(true);
      setMessage({ text: 'Please log in to like comments', type: 'error' });
      setTimeout(() => {
        setMessage({ text: '', type: '' });
      }, 3000);
      return;
    }

    setComments(prev => prev.map(comment => {
      if (isReply && parentId === comment.id) {
        return {
          ...comment,
          replies: comment.replies.map(reply => {
            if (reply.id === commentId) {
              const currentLikes = parseInt(reply.likes) || 0;
              return {
                ...reply,
                likes: reply.liked ? currentLikes - 1 : currentLikes + 1,
                liked: !reply.liked
              };
            }
            return reply;
          })
        };
      }
      if (!isReply && comment.id === commentId) {
        const currentLikes = parseInt(comment.likes) || 0;
        return {
          ...comment,
          likes: comment.liked ? currentLikes - 1 : currentLikes + 1,
          liked: !comment.liked
        };
      }
      return comment;
    }));
  };

  const handleLoginRedirect = () => {
    navigate('/auth', { state: { returnPath: `/expert/${expertId}` } });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Invalid date';
    
    try {
      // Handle Firestore Timestamp
      if (timestamp && typeof timestamp.toDate === 'function') {
        return formatDistanceToNow(timestamp.toDate(), { addSuffix: true });
      }
      // Handle JavaScript Date object
      if (timestamp instanceof Date) {
        return formatDistanceToNow(timestamp, { addSuffix: true });
      }
      // Handle numeric timestamp
      if (typeof timestamp === 'number') {
        return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
      }
      return 'Invalid date';
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  return (
    <div className="comments-section">
      <h3>Comments ({comments.length || 0})</h3>
      
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
      
      <div className="comment-form">
        {currentUser && (
          <div className="current-user">
            <div className="user-avatar" style={{ backgroundColor: getAvatarColor(getUserDisplayName(currentUser)) }}>
              {getInitials(getUserDisplayName(currentUser))}
            </div>
            <span>{getUserDisplayName(currentUser)}</span>
          </div>
        )}
        <textarea
          className="comment-input"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write your comment..."
          disabled={!currentUser}
        />
        <button 
          className="post-comment-btn"
          onClick={handlePostComment}
          disabled={!currentUser || !newComment.trim() || isPosting}
        >
          <i className="fas fa-paper-plane"></i>
          {isPosting ? 'Posting...' : 'Post Comment'}
        </button>
      </div>
      
      {!currentUser && showLoginPrompt && (
        <div className="login-prompt-container">
          <p className="login-prompt">Please log in to leave a comment</p>
          <button className="login-button" onClick={handleLoginRedirect}>
            Log In Now
          </button>
        </div>
      )}
      
      {loading ? (
        <div className="loading-comments">
          <div className="loading-spinner"></div>
          <p>Loading comments...</p>
        </div>
      ) : error ? (
        <p className="error">{error}</p>
      ) : (
        <div className="comments-list">
          {comments.length > 0 ? (
            comments.sort((a, b) => {
              const dateA = a.timestamp ? (typeof a.timestamp.toDate === 'function' ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date();
              const dateB = b.timestamp ? (typeof b.timestamp.toDate === 'function' ? b.timestamp.toDate() : new Date(b.timestamp)) : new Date();
              return dateB - dateA;
            }).map(comment => (
              <div key={comment.id} className="comment-item">
                <div className="comment-avatar" style={{ backgroundColor: getAvatarColor(comment.userName) }}>
                  {getInitials(comment.userName)}
                </div>
                <div className="comment-content">
                  <div className="comment-header">
                    <strong className="comment-author">{comment.userName}</strong>
                    <span className="comment-date">{formatDate(comment.timestamp)}</span>
                  </div>
                  <p className="comment-text">{comment.text}</p>
                  <div className="comment-actions">
                    <button 
                      className={`comment-action ${comment.liked ? 'liked' : ''}`}
                      onClick={() => toggleLike(comment.id)}
                    >
                      <i className={`${comment.liked ? 'fas' : 'far'} fa-heart`}></i>
                      {comment.likes}
                    </button>
                    <button 
                      className="comment-action"
                      onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                    >
                      <i className="far fa-comment"></i>
                      Reply
                    </button>
                  </div>

                  {/* Reply Form */}
                  {replyingTo === comment.id && (
                    <div className="reply-form">
                      <textarea
                        className="reply-input"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write your reply..."
                        disabled={!currentUser}
                      />
                      <button 
                        className="post-comment-btn"
                        onClick={() => handlePostReply(comment.id)}
                        disabled={!currentUser || !replyText.trim()}
                      >
                        <i className="fas fa-reply"></i>
                        Post Reply
                      </button>
                    </div>
                  )}

                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="replies-container">
                      {comment.replies.map(reply => (
                        <div key={reply.id} className="comment-item">
                          <div className="comment-avatar">
                            {getInitials(reply.author)}
                          </div>
                          <div className="comment-content">
                            <div className="comment-header">
                              <span className="comment-author">{reply.author}</span>
                              <span className="comment-date">
                                {formatDate(reply.date)}
                              </span>
                            </div>
                            <p className="comment-text">{reply.text}</p>
                            <div className="comment-actions">
                              <button 
                                className={`comment-action ${reply.liked ? 'liked' : ''}`}
                                onClick={() => toggleLike(reply.id, true, comment.id)}
                              >
                                <i className={`${reply.liked ? 'fas' : 'far'} fa-heart`}></i>
                                {reply.likes}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="no-comments">No comments yet. Be the first to comment!</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection; 