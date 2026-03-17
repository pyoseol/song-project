import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DUMMY_POSTS } from '../../dummy/mockData'; // 더미 데이터

const PostList: React.FC = () => {
  const navigate = useNavigate();

  // 공통 스타일 정의
  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      minHeight: '100vh',
      background: '#121212',
      color: '#eee',
    },
    navBar: {
      height: '60px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: '#000',
      padding: '0 20px',
      borderBottom: '1px solid #333',
    },
    navButton: {
      padding: '8px 16px',
      borderRadius: '20px',
      border: '1px solid #444',
      background: '#222',
      color: '#fff',
      cursor: 'pointer',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'background 0.2s',
    },
    mainContent: {
      flex: 1,
      padding: '30px 20px',
      maxWidth: '800px',
      width: '100%',
      margin: '0 auto',
      boxSizing: 'border-box' as const,
    },
    postCard: {
      background: '#222',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '15px',
      cursor: 'pointer',
      transition: 'transform 0.2s, background 0.2s',
    },
    postTitle: {
      margin: '0 0 10px 0',
      fontSize: '18px',
      color: '#4ade80', // 멜로디 색상 포인트
    },
    postMeta: {
      fontSize: '14px',
      color: '#888',
      display: 'flex',
      justifyContent: 'space-between',
    },
  };

  return (
    <div style={styles.container}>
      {/* 상단 네비게이션 바 */}
      <nav style={styles.navBar}>
        {/* 왼쪽: 작곡 페이지로 돌아가기 버튼 */}
        <button 
          onClick={() => navigate('/')}
          style={styles.navButton}
          onMouseOver={(e) => e.currentTarget.style.background = '#333'}
          onMouseOut={(e) => e.currentTarget.style.background = '#222'}
        >
          🎵 작곡하러 가기
        </button>
        
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'normal' }}>커뮤니티</h2>

        {/* 오른쪽: 글쓰기 버튼 */}
        <button 
          onClick={() => navigate('/community/write')}
          style={{ ...styles.navButton, background: '#4ade80', color: '#000', fontWeight: 'bold', border: 'none' }}
          onMouseOver={(e) => e.currentTarget.style.background = '#38bdf8'} // 드럼 색상으로 호버 효과
          onMouseOut={(e) => e.currentTarget.style.background = '#4ade80'}
        >
          ✏️ 글쓰기
        </button>
      </nav>
      
      {/* 메인 컨텐츠 영역 */}
      <main style={styles.mainContent}>
        {DUMMY_POSTS.map((post) => (
          <div 
            key={post.id} 
            onClick={() => navigate(`/community/${post.id}`)}
            style={styles.postCard}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#2a2a2a';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#222';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <h3 style={styles.postTitle}>{post.title}</h3>
            <div style={styles.postMeta}>
              <span>작성자: {post.authorName}</span>
              <span>♥ {post.likeCount} | {new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
};

export default PostList;