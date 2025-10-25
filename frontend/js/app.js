// 配置
const isDevelopment = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';

const API_URL = isDevelopment 
  ? 'http://localhost:3000/api'
  : 'https://voting-system-production-ef7c.up.railway.app/api';

const SOCKET_URL = isDevelopment
  ? 'http://localhost:3000'
  : 'https://voting-system-production-ef7c.up.railway.app';

// 全局变量
let socket;
let userChoices = { q1: null, q2: null, q3: null };
let hasVoted = false;
let currentPage = 1;
let likedComments = new Set(JSON.parse(localStorage.getItem('likedComments') || '[]'));

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    initStars();
    initSocket();
    await checkVoteStatus();
    await loadStats();
    await loadComments();
    initEventListeners();
});

// 创建星空
function initStars() {
    const starsContainer = document.getElementById('stars');
    for (let i = 0; i < 100; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.width = Math.random() * 3 + 'px';
        star.style.height = star.style.width;
        star.style.animationDelay = Math.random() * 3 + 's';
        starsContainer.appendChild(star);
    }
}

// 初始化Socket.IO
function initSocket() {
    socket = io(SOCKET_URL);
    
    socket.on('connect', () => {
        console.log('✅ WebSocket连接成功');
        updateOnlineStatus(true);
    });
    
    socket.on('disconnect', () => {
        console.log('❌ WebSocket断开连接');
        updateOnlineStatus(false);
    });
    
    // 监听投票更新
    socket.on('vote-update', (data) => {
        console.log('📊 收到投票更新', data);
        updateResults(data);
    });
    
    // 监听新评论
    socket.on('new-comment', (comment) => {
        console.log('💬 收到新评论', comment);
        prependComment(comment);
    });
    
    // 监听点赞更新
    socket.on('comment-like', ({ commentId, likes }) => {
        updateCommentLikes(commentId, likes);
    });
    
    // 监听评论删除
    socket.on('comment-deleted', (commentId) => {
        removeComment(commentId);
    });
}

// 更新在线状态
function updateOnlineStatus(isOnline) {
    const statusDot = document.getElementById('statusDot');
    statusDot.classList.toggle('offline', !isOnline);
}

// 检查投票状态
// 检查投票状态（移除限制版）
async function checkVoteStatus() {
    // 不再检查是否已投票，允许无限投票
    hasVoted = false;
}

// 加载统计数据
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/votes/stats`);
        const data = await response.json();
        
        if (data.success) {
            updateResults(data);
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

// 更新结果显示
function updateResults(data) {
    const { stats, totalVoters } = data;
    
    // 更新总投票数
    document.getElementById('totalVotes').textContent = totalVoters || 0;
    document.getElementById('stats').classList.add('show');
    
    // 更新每个问题的结果
    updateQuestionResult('q1', stats.q1, ['arrival', 'save'], {
        arrival: '降临派',
        save: '拯救派'
    });
    
    updateQuestionResult('q2', stats.q2, ['death', 'live'], {
        death: '死亡',
        live: '活着'
    });
    
    updateQuestionResult('q3', stats.q3, ['exist', 'extinct'], {
        exist: '存在',
        extinct: '灭绝'
    });
}

// 更新单个问题的结果
function updateQuestionResult(question, data, options, labels) {
    const resultContainer = document.getElementById(`result-${question}`);
    const total = options.reduce((sum, opt) => sum + (data[opt] || 0), 0);
    
    if (total === 0) {
        resultContainer.innerHTML = options.map(opt => `
            <div class="result-item">
                <div class="result-label">
                    <span>${labels[opt]}</span>
                    <span>0%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
            </div>
        `).join('');
        return;
    }
    
    let maxVotes = 0;
    let winner = null;
    
    const results = options.map(opt => {
        const votes = data[opt] || 0;
        const percent = (votes / total * 100).toFixed(1);
        
        if (votes > maxVotes) {
            maxVotes = votes;
            winner = opt;
        }
        
        return { opt, votes, percent, label: labels[opt] };
    });
    
    resultContainer.innerHTML = results.map(({ opt, percent, label }) => `
        <div class="result-item">
            <div class="result-label">
                <span>${label}</span>
                <span>${percent}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill ${opt === winner ? 'winner-bar' : ''}" 
                     style="width: ${percent}%"></div>
            </div>
        </div>
    `).join('');
    
    // 高亮获胜选项按钮
    options.forEach(opt => {
        const btn = document.querySelector(`[data-question="${question}"][data-option="${opt}"]`);
        if (btn) {
            btn.classList.toggle('winner', opt === winner && maxVotes > 0);
        }
    });
}

// 初始化事件监听器
function initEventListeners() {
    // 初始化时清除所有选项的选中状态，确保新用户看到干净的界面
    document.querySelectorAll('.option-btn.selected').forEach(btn => {
        btn.classList.remove('selected');
    });

    // 选项点击
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (hasVoted) {
                showToast('您已经投过票了！', 'error');
                return;
            }
            
            const question = this.dataset.question;
            const option = this.dataset.option;
            
            // 取消同问题其他选项
            document.querySelectorAll(`[data-question="${question}"]`).forEach(b => {
                b.classList.remove('selected');
            });
            
            // 选中当前选项
            this.classList.add('selected');
            userChoices[question] = option;
            
            updateSubmitButton();
        });
    });
    
    // 提交投票
    document.getElementById('submitBtn').addEventListener('click', submitVote);
    
    // 查看结果
    document.getElementById('resultBtn').addEventListener('click', showResults);
    
    // 评论输入字数统计
    const commentInput = document.getElementById('commentInput');
    commentInput.addEventListener('input', () => {
        document.getElementById('charCount').textContent = commentInput.value.length;
    });
    
    // 提交评论
    document.getElementById('submitComment').addEventListener('click', submitComment);
    
    // 加载更多评论
    document.getElementById('loadMoreBtn').addEventListener('click', loadMoreComments);
}

// 更新提交按钮状态
function updateSubmitButton() {
    const submitBtn = document.getElementById('submitBtn');
    const allSelected = userChoices.q1 && userChoices.q2 && userChoices.q3;
    submitBtn.disabled = !allSelected || hasVoted;
}

// 提交投票
async function submitVote() {
    if (!userChoices.q1 || !userChoices.q2 || !userChoices.q3) {
        showToast('请完成所有问题的选择！', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_URL}/votes/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ votes: userChoices })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showResults();
            
            // 清除选中状态的视觉效果（移除高亮）
            document.querySelectorAll('.option-btn.selected').forEach(btn => {
                btn.classList.remove('selected');
            });

            // 重置用户选择
            userChoices = { q1: null, q2: null, q3: null };
            
            // 允许再次投票
            hasVoted = false;
            updateSubmitButton();
            
            showToast('投票成功！感谢您的参与。', 'success');
            
            // Socket.IO会自动推送更新，但我们也手动更新一次
            if (data.stats) {
                updateResults(data.stats);
            }
        } else {
            showToast(data.message || '投票失败', 'error');
        }
    } catch (error) {
        console.error('提交投票失败:', error);
        showToast('网络错误，请稍后重试', 'error');
    } finally {
        showLoading(false);
    }
}

// 禁用投票
function disableVoting() {
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.cursor = 'not-allowed';
    });
    document.getElementById('submitBtn').disabled = true;
}

// 显示结果
function showResults() {
    document.querySelectorAll('.result-bar').forEach(bar => {
        bar.classList.add('show');
    });
}

// 加载评论
async function loadComments(page = 1) {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_URL}/comments?page=${page}&limit=20`);
        const data = await response.json();
        
        if (data.success) {
            const commentsList = document.getElementById('commentsList');
            
            if (page === 1) {
                commentsList.innerHTML = '';
            }
            
            data.comments.forEach(comment => {
                appendComment(comment);
            });
            
            // 更新加载更多按钮
            const loadMoreBtn = document.getElementById('loadMoreBtn');
            if (page >= data.pagination.pages) {
                loadMoreBtn.disabled = true;
                loadMoreBtn.textContent = '没有更多了';
            } else {
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = '加载更多';
            }
            
            currentPage = page;
        }
    } catch (error) {
        console.error('加载评论失败:', error);
        showToast('加载评论失败', 'error');
    } finally {
        showLoading(false);
    }
}

// 加载更多评论
function loadMoreComments() {
    loadComments(currentPage + 1);
}

// 添加评论到列表（末尾）
function appendComment(comment) {
    const commentsList = document.getElementById('commentsList');
    const commentEl = createCommentElement(comment);
    commentsList.appendChild(commentEl);
}

// 添加评论到列表（开头）
function prependComment(comment) {
    const commentsList = document.getElementById('commentsList');
    const commentEl = createCommentElement(comment);
    commentsList.insertBefore(commentEl, commentsList.firstChild);
}

// 创建评论元素
function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.dataset.commentId = comment._id;
    
    const userInitial = comment.nickname.charAt(0).toUpperCase();
    const timeAgo = formatTimeAgo(new Date(comment.timestamp));
    
    const voteBadges = [];
    if (comment.votes.q1) voteBadges.push(getVoteLabel('q1', comment.votes.q1));
    if (comment.votes.q2) voteBadges.push(getVoteLabel('q2', comment.votes.q2));
    if (comment.votes.q3) voteBadges.push(getVoteLabel('q3', comment.votes.q3));
    
    const isLiked = likedComments.has(comment._id);
    
    div.innerHTML = `
        <div class="comment-header">
            <div class="comment-user">
                <div class="user-avatar">${userInitial}</div>
                <div class="user-info">
                    <div class="user-nickname">${escapeHtml(comment.nickname)}</div>
                    <div class="user-location">📍 ${comment.ipInfo?.city || '未知'}, ${comment.ipInfo?.country || '未知'}</div>
                </div>
            </div>
            <div class="comment-time">${timeAgo}</div>
        </div>
        ${voteBadges.length > 0 ? `
        <div class="comment-votes">
            ${voteBadges.map(badge => `<span class="vote-badge">${badge}</span>`).join('')}
        </div>
        ` : ''}
        <div class="comment-content">${escapeHtml(comment.content)}</div>
        <div class="comment-footer">
            <button class="like-btn ${isLiked ? 'liked' : ''}" data-comment-id="${comment._id}">
                <span class="like-icon">${isLiked ? '❤️' : '🤍'}</span>
                <span class="like-count">${comment.likes || 0}</span>
            </button>
        </div>
    `;
    
    // 点赞事件
    const likeBtn = div.querySelector('.like-btn');
    likeBtn.addEventListener('click', () => likeComment(comment._id));
    
    return div;
}

// 获取投票标签
function getVoteLabel(question, option) {
    const labels = {
        q1: { arrival: '🛸 降临派', save: '🦸 拯救派' },
        q2: { death: '💀 死亡', live: '❤️ 活着' },
        q3: { exist: '🌍 存在', extinct: '☄️ 灭绝' }
    };
    return labels[question]?.[option] || '';
}

// 提交评论
async function submitComment() {
    const content = document.getElementById('commentInput').value.trim();
    const nickname = document.getElementById('nicknameInput').value.trim() || '匿名用户';
    
    if (!content) {
        showToast('请输入评论内容', 'error');
        return;
    }
    
    if (content.length > 500) {
        showToast('评论内容过长', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_URL}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content, nickname })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('评论发表成功！', 'success');
            document.getElementById('commentInput').value = '';
            document.getElementById('nicknameInput').value = '';
            document.getElementById('charCount').textContent = '0';
            
            // Socket.IO会推送新评论，但我们也可以手动添加
            // prependComment(data.comment);
        } else {
            showToast(data.message || '评论发表失败', 'error');
        }
    } catch (error) {
        console.error('提交评论失败:', error);
        showToast('网络错误，请稍后重试', 'error');
    } finally {
        showLoading(false);
    }
}

// 点赞评论
async function likeComment(commentId) {
    try {
        const response = await fetch(`${API_URL}/comments/${commentId}/like`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 更新本地状态
            if (data.hasLiked) {
                likedComments.add(commentId);
            } else {
                likedComments.delete(commentId);
            }
            localStorage.setItem('likedComments', JSON.stringify([...likedComments]));
            
            // 更新UI会通过Socket.IO推送
            // updateCommentLikes(commentId, data.likes);
        }
    } catch (error) {
        console.error('点赞失败:', error);
        showToast('操作失败', 'error');
    }
}

// 更新评论点赞数
function updateCommentLikes(commentId, likes) {
    const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
    if (commentEl) {
        const likeBtn = commentEl.closest('.comment-item').querySelector('.like-btn');
        const likeCount = likeBtn.querySelector('.like-count');
        const likeIcon = likeBtn.querySelector('.like-icon');
        
        likeCount.textContent = likes;
        
        const isLiked = likedComments.has(commentId);
        likeBtn.classList.toggle('liked', isLiked);
        likeIcon.textContent = isLiked ? '❤️' : '🤍';
    }
}

// 移除评论
function removeComment(commentId) {
    const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`)?.closest('.comment-item');
    if (commentEl) {
        commentEl.remove();
    }
}

// 工具函数：时间格式化
function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    const intervals = {
        年: 31536000,
        月: 2592000,
        周: 604800,
        天: 86400,
        小时: 3600,
        分钟: 60
    };
    
    for (let [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval}${unit}前`;
        }
    }
    
    return '刚刚';
}

// 工具函数：HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 显示Toast
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 显示/隐藏加载指示器
function showLoading(show) {
    document.getElementById('loading').classList.toggle('show', show);
}