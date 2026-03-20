import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Post } from '../../types/community'; 
import { DUMMY_POSTS } from '../../dummy/mockData'; 

const PostDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>(); 
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);

  useEffect(() => {
    const foundPost = DUMMY_POSTS.find((p) => p.id === id);
    if (foundPost) setPost(foundPost);
  }, [id]);

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
      articleCard: {
        background: '#222',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '30px',
      },
      title: {
        marginTop: 0,
        fontSize: '28px',
        color: '#4ade80',
      },
      meta: {
        display: 'flex',
        justifyContent: 'space-between',
        color: '#888',
        fontSize: '14px',
        borderBottom: '1px solid #333',
        paddingBottom: '15px',
        marginBottom: '20px',
      },
      content: {
        minHeight: '200px',
        whiteSpace: 'pre-wrap' as const,
        lineHeight: '1.8',
        fontSize: '16px',
        color: '#ddd'
      }
  };

  if (!post) return <div style={styles.container}>존재하지 않는 게시글입니다.</div>;

  return (
    <div style={styles.container}>
        <nav style={styles.navBar}>
            <button onClick={() => navigate('/community')} style={styles.backButton}>
            &lt; 목록으로
            </button>
        </nav>
      
        <main style={styles.mainContent}>
            <article style={styles.articleCard}>
                <h1 style={styles.title}>{post.title}</h1>
                
                <div style={styles.meta}>
                    <span>작성자: <strong>{post.authorName}</strong></span>
                    <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                </div>
                
                <div style={styles.content}>
                {post.content}
                </div>
                
                <div style={{ marginTop: '30px', textAlign: 'center' }}>
                    <button style={{ padding: '10px 20px', borderRadius: '30px', border: '2px solid #f97316', background: 'transparent', color: '#f97316', cursor: 'pointer', fontWeight: 'bold' }}>
                        ♥ 좋아요 {post.likeCount}
                    </button>
                </div>
            </article>
        </main>
    </div>
  );
};

export default PostDetail;