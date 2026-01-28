import { NextResponse } from 'next/server';

const GITHUB_REPO_OWNER = 'rouges78';
const GITHUB_REPO_NAME = 'GameStringer';

// GraphQL query per ottenere le discussions
const DISCUSSIONS_QUERY = `
  query($owner: String!, $name: String!, $first: Int!) {
    repository(owner: $owner, name: $name) {
      discussions(first: $first, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          id
          number
          title
          body
          author {
            login
            avatarUrl
          }
          category {
            name
            emoji
          }
          createdAt
          updatedAt
          comments {
            totalCount
          }
          upvoteCount
          answerChosenAt
          url
        }
      }
    }
  }
`;

export async function GET() {
  try {
    // Prima prova senza token (pubblico)
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Token opzionale per rate limit più alto
        ...(process.env.GITHUB_TOKEN ? { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` } : {})
      },
      body: JSON.stringify({
        query: DISCUSSIONS_QUERY,
        variables: {
          owner: GITHUB_REPO_OWNER,
          name: GITHUB_REPO_NAME,
          first: 20
        }
      })
    });

    if (!response.ok) {
      // Fallback: scrape della pagina HTML delle discussions
      return await scrapeDiscussions();
    }

    const data = await response.json();
    
    if (data.errors) {
      // GraphQL senza auth non funziona, prova scraping
      return await scrapeDiscussions();
    }

    const discussions = data.data?.repository?.discussions?.nodes || [];
    return NextResponse.json(discussions);
    
  } catch (error) {
    console.error('Error fetching discussions:', error);
    return await scrapeDiscussions();
  }
}

// Fallback: scrape della pagina HTML
async function scrapeDiscussions() {
  try {
    const response = await fetch(
      `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/discussions`,
      {
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'GameStringer/1.0'
        }
      }
    );

    if (!response.ok) {
      return NextResponse.json([]);
    }

    const html = await response.text();
    
    // Parse semplice per estrarre le discussions dalla pagina HTML
    const discussions: any[] = [];
    
    // Regex per trovare i link alle discussions
    const discussionRegex = /\/discussions\/(\d+)"[^>]*>([^<]+)</g;
    let match;
    
    while ((match = discussionRegex.exec(html)) !== null && discussions.length < 20) {
      const [, number, title] = match;
      
      // Evita duplicati
      if (!discussions.find(d => d.number === parseInt(number))) {
        discussions.push({
          id: `discussion_${number}`,
          number: parseInt(number),
          title: title.trim(),
          body: '',
          author: { login: 'unknown', avatarUrl: '' },
          category: { name: 'General', emoji: '💬' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          comments: { totalCount: 0 },
          upvoteCount: 0,
          answerChosenAt: null,
          url: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/discussions/${number}`
        });
      }
    }

    return NextResponse.json(discussions);
    
  } catch (error) {
    console.error('Error scraping discussions:', error);
    return NextResponse.json([]);
  }
}
