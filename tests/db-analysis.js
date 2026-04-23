#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:55432/clocknet?schema=public';

async function analyzeDatabase() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('✓ Connected to PostgreSQL\n');

    // Query 1: Connection pool status
    console.log('=== CONNECTION POOL STATUS ===');
    const poolStatus = await client.query(`
      SELECT 
        pid,
        usename,
        application_name,
        state,
        query,
        state_change
      FROM pg_stat_activity
      WHERE datname = 'clocknet'
      ORDER BY state_change DESC;
    `);

    console.log(`Active connections: ${poolStatus.rows.length}`);
    poolStatus.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. PID ${row.pid}: ${row.state} - ${row.query?.slice(0, 50)}`);
    });

    // Query 2: Table sizes
    console.log('\n=== TABLE SIZES ===');
    const tableSizes = await client.query(`
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tablename) AS exists
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    `);

    tableSizes.rows.forEach((row) => {
      console.log(`  ${row.tablename}: ${row.size}`);
    });

    // Query 3: Index usage
    console.log('\n=== INDEX USAGE & EFFICIENCY ===');
    const indexUsage = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY idx_scan DESC;
    `);

    console.log(`Indexes: ${indexUsage.rows.length}`);
    indexUsage.rows.forEach((row) => {
      console.log(`  ${row.tablename}.${row.indexname}: ${row.idx_scan} scans`);
    });

    // Query 4: Slow queries
    console.log('\n=== SLOW QUERIES (avg > 100ms) ===');
    const slowQueries = await client.query(`
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        max_time
      FROM pg_stat_statements
      WHERE mean_time > 100
      ORDER BY mean_time DESC
      LIMIT 10;
    `);

    if (slowQueries.rows.length === 0) {
      console.log('  No queries with mean time > 100ms');
    } else {
      slowQueries.rows.forEach((row) => {
        console.log(`  Query: ${row.query.slice(0, 60)}...`);
        console.log(`    Calls: ${row.calls}, Avg: ${row.mean_time.toFixed(2)}ms, Max: ${row.max_time.toFixed(2)}ms`);
      });
    }

    // Query 5: Lock conflicts
    console.log('\n=== LOCK ANALYSIS ===');
    const locks = await client.query(`
      SELECT 
        schemaname,
        tablename,
        COUNT(*) AS lock_count
      FROM pg_locks
      JOIN pg_class ON pg_locks.relation = pg_class.oid
      LEFT JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
      LEFT JOIN information_schema.tables ON pg_namespace.nspname = information_schema.tables.table_schema 
        AND pg_class.relname = information_schema.tables.table_name
      WHERE pg_namespace.nspname = 'public'
      GROUP BY schemaname, tablename
      ORDER BY lock_count DESC;
    `);

    console.log(`Tables with locks: ${locks.rows.length}`);
    locks.rows.forEach((row) => {
      console.log(`  ${row.tablename}: ${row.lock_count} locks`);
    });

    // Query 6: Database statistics
    console.log('\n=== DATABASE STATISTICS ===');
    const stats = await client.query(`
      SELECT 
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch,
        n_tup_ins,
        n_tup_upd,
        n_tup_del,
        last_vacuum,
        last_autovacuum
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC;
    `);

    stats.rows.forEach((row) => {
      console.log(`\n  Table: ${row.tablename}`);
      console.log(`    Seq Scans: ${row.seq_scan}, Tuples Read: ${row.seq_tup_read}`);
      console.log(`    Index Scans: ${row.idx_scan}, Tuples Fetched: ${row.idx_tup_fetch}`);
      console.log(`    Inserts: ${row.n_tup_ins}, Updates: ${row.n_tup_upd}, Deletes: ${row.n_tup_del}`);
      console.log(`    Last Vacuum: ${row.last_vacuum}`);
      console.log(`    Last Auto-vacuum: ${row.last_autovacuum}`);
    });

    // Query 7: Row counts
    console.log('\n=== ROW COUNTS ===');
    const rowCounts = await client.query(`
      SELECT 
        tablename,
        n_live_tup AS live_rows,
        n_dead_tup AS dead_rows
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_live_tup DESC;
    `);

    rowCounts.rows.forEach((row) => {
      console.log(`  ${row.tablename}: ${row.live_rows} live, ${row.dead_rows} dead`);
    });

    // Query 8: Cache hit ratio
    console.log('\n=== CACHE HIT RATIO ===');
    const cacheHitRatio = await client.query(`
      SELECT 
        sum(heap_blks_read) as heap_read,
        sum(heap_blks_hit) as heap_hit,
        sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
      FROM pg_statio_user_tables;
    `);

    const ratio = cacheHitRatio.rows[0];
    if (ratio.ratio !== null) {
      console.log(`  Cache hit ratio: ${(ratio.ratio * 100).toFixed(2)}%`);
      console.log(`  Heap reads: ${ratio.heap_read}, Heap hits: ${ratio.heap_hit}`);
    }

    // Query 9: Bloat analysis
    console.log('\n=== BLOAT ANALYSIS ===');
    const bloat = await client.query(`
      SELECT 
        schemaname,
        tablename,
        round(100.0 * pg_relation_size(schemaname||'.'||tablename) / 
          pg_total_relation_size(schemaname||'.'||tablename), 2) as table_bloat_percent
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY 3 DESC;
    `);

    bloat.rows.forEach((row) => {
      if (row.table_bloat_percent > 10) {
        console.log(`  ${row.tablename}: ${row.table_bloat_percent}% bloat (High)`);
      }
    });

    if (bloat.rows.every(row => row.table_bloat_percent <= 10)) {
      console.log('  All tables have healthy bloat levels (< 10%)');
    }

    console.log('\n✓ Database analysis complete');
  } catch (error) {
    console.error('Error analyzing database:', error.message);
    if (error.message.includes('pg_stat_statements')) {
      console.log('\nNote: pg_stat_statements extension not installed.');
      console.log('Run: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;');
    }
  } finally {
    await client.end();
  }
}

analyzeDatabase().catch(console.error);
