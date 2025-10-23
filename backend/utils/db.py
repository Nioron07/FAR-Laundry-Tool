"""Database utilities for Cloud SQL MySQL connection"""
import os
import pymysql
from google.cloud.sql.connector import Connector
from contextlib import contextmanager

# Database connection configuration
DB_CONFIG = {
    'instance_connection_name': os.environ.get('INSTANCE_CONNECTION_NAME', ''),
    'user': os.environ.get('DB_USER', ''),
    'password': os.environ.get('DB_PASS', ''),
    'database': os.environ.get('DB_NAME', ''),
}

# Global connector instance
connector = None


def get_connector():
    """Get or create Cloud SQL Connector instance"""
    global connector
    if connector is None:
        connector = Connector()
    return connector


def get_connection():
    """Create a new database connection using Cloud SQL Connector"""
    conn = get_connector()

    connection = connector.connect(
        DB_CONFIG['instance_connection_name'],
        "pymysql",
        user=DB_CONFIG['user'],
        password=DB_CONFIG['password'],
        db=DB_CONFIG['database'],
    )

    return connection


@contextmanager
def get_db_cursor(dict_cursor=True):
    """Context manager for database cursor

    Args:
        dict_cursor: If True, returns DictCursor. Otherwise returns regular Cursor.

    Yields:
        cursor: Database cursor
    """
    connection = get_connection()
    try:
        if dict_cursor:
            cursor = connection.cursor(pymysql.cursors.DictCursor)
        else:
            cursor = connection.cursor()
        yield cursor
        connection.commit()
    except Exception as e:
        connection.rollback()
        raise e
    finally:
        cursor.close()
        connection.close()


def query_database(query, params=None):
    """Execute a SELECT query and return results as list of dicts

    Args:
        query: SQL query string
        params: Query parameters (list or tuple)

    Returns:
        List of dictionaries representing query results
    """
    with get_db_cursor(dict_cursor=True) as cursor:
        cursor.execute(query, params or [])
        results = cursor.fetchall()
        return results


def execute_query(query, params=None):
    """Execute an INSERT/UPDATE/DELETE query

    Args:
        query: SQL query string
        params: Query parameters (list or tuple)

    Returns:
        Number of affected rows
    """
    with get_db_cursor(dict_cursor=False) as cursor:
        affected = cursor.execute(query, params or [])
        return affected


def close_connector():
    """Close the Cloud SQL Connector (call on shutdown)"""
    global connector
    if connector is not None:
        connector.close()
        connector = None
