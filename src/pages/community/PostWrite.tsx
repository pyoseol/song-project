import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PostWrite: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 나중에 여기에 실제 저장 로직 구현
    console.log('작성된 글:', { title, content });
    alert('글이 등록되었습니다. (더미)');
    navigate('/community');
  };

  // 스타일 정의
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
      alignItems: 'center',
      background: '#000',
      padding: '0 20px',
      borderBottom: '1px solid #333',
    },
    backButton: {
      background: 'transparent',
      border: 'none',
      color: '#888',
      fontSize: '16px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
    },
    mainContent: {
      flex: 1,
      padding: '30px 20px',
      maxWidth: '800px',
      width: '100%',
      margin: '0 auto',
      boxSizing: 'border-box' as const,
    },
    input: {
      width: '100%',
      padding: '15px',
      marginBottom: '20px',
      background: '#222',
      border: '1px solid #333',
      borderRadius: '8px',
      color: 'white',
      fontSize: '16px',
      boxSizing: 'border-box' as const,
      outline: 'none',
    },
    textarea: {
      width: '100%',
      padding: '15px',
      minHeight: '300px',
      background: '#222',
      border: '1px solid #333',
      borderRadius: '8px',
      color: 'white',
      fontSize: '16px',
      resize: 'vertical' as const,
      boxSizing: 'border-box' as const,
      outline: 'none',
      fontFamily: 'inherit',
    },
    submitButton: {
      width: '100%',
      padding: '15px',
      marginTop: '20px',
      background: '#4ade80', // 멜로디 그린 색상
      color: '#000',
      border: 'none',
      borderRadius: '8px',
      fontSize: '18px',
      fontWeight: 'bold',
      cursor: 'pointer',
      transition: 'background 0.2s',
    },
  };

  return (
    <div style={styles.container}>
      {/* 상단 네비게이션 */}
      <nav style={styles.navBar}>
        <button onClick={() => navigate('/community')} style={styles.backButton}>
          &lt; 취소
        </button>
        <h2 style={{ margin: '0 auto', fontSize: '18px', fontWeight: 'normal', transform: 'translateX(-20px)' }}>새 게시글 작성</h2>
      </nav>

      {/* 글쓰기 폼 */}
      <main style={styles.mainContent}>
        <form onSubmit={handleSubmit}>
          <input 
            type="text" 
            placeholder="제목을 입력하세요" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            style={styles.input}
            onFocus={(e) => e.currentTarget.style.borderColor = '#4ade80'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#333'}
          />
          <textarea 
            placeholder="내용을 자유롭게 작성해주세요." 
            value={content} 
            onChange={(e) => setContent(e.target.value)}
            style={styles.textarea}
            onFocus={(e) => e.currentTarget.style.borderColor = '#4ade80'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#333'}
          />
          <button 
            type="submit" 
            style={styles.submitButton}
            onMouseOver={(e) => e.currentTarget.style.background = '#38bdf8'}
            onMouseOut={(e) => e.currentTarget.style.background = '#4ade80'}
          >
            등록하기
          </button>
        </form>
      </main>
    </div>
  );
};

export default PostWrite;